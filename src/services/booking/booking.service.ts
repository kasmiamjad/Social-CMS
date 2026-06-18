import { createAdminClient } from "@/lib/supabase/admin";
import { WhatsAppService, WhatsAppApiError } from "@/services/platforms/whatsapp/whatsapp.service";
import type { WhatsAppCredentials } from "@/services/platforms/whatsapp/whatsapp.types";
import {
  BOOKING_TEMPLATE_LANGUAGE,
  BOOKING_TEMPLATE_NAME,
  BOOKING_WHATSAPP_AUTOSEND,
  buildBookingFreeText,
  buildBookingTemplateComponents,
  composeBookingRef,
  formatBookingDate,
  formatBookingTime,
  type BookingMessageFields,
} from "./booking.constants";

/** Window (ms) inside which Meta allows free-form text. */
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type BookingStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface CreateBookingInput {
  leadId: string;
  /** ISO timestamp for the scheduled installation. */
  scheduledAt: string;
  /** Optional friendly slot ("Morning 9–12"); shown instead of the time if set. */
  slotLabel?: string | null;
  unitPrice?: number | null;
  technician?: string | null;
  notes?: string | null;
  /** Assigned technician + availability slot (slot is claimed on book). */
  technicianId?: string | null;
  slotId?: string | null;
}

export interface CreateBookingResult {
  booking: Record<string, unknown>;
  /** The ready-to-send confirmation text (always returned for copy-paste). */
  confirmationText: string;
  /** Whether the WhatsApp confirmation was auto-delivered (false while paused). */
  confirmationSent: boolean;
  deliveryMethod: "template" | "free_text" | null;
  /** Human-readable reason the confirmation failed (if any). */
  confirmationError: string | null;
}

interface LeadRow {
  id: string;
  user_id: string;
  client_name: string;
  client_phone: string | null;
  product_model: string | null;
  product_qty: number | null;
  location_address: string | null;
  whatsapp_conversation_id: string | null;
}

interface PlatformCredentialsRow {
  credentials: WhatsAppCredentials;
}

/**
 * Converts a lead into a confirmed installation booking and notifies the
 * customer over WhatsApp.
 *
 * The booking is always created; the WhatsApp confirmation is best-effort —
 * if Meta rejects the send (e.g. the template isn't approved yet, or the 24h
 * window is closed and no template exists), the booking persists and the
 * failure is recorded on the row + returned to the caller for display.
 */
export class BookingService {
  /**
   * @throws Error with code-like messages the API route maps to responses:
   *   "LEAD_NOT_FOUND", "LEAD_NO_PHONE"
   */
  async createBookingAndConfirm(
    userId: string,
    input: CreateBookingInput
  ): Promise<CreateBookingResult> {
    const supabase = createAdminClient();

    // 1. Load + verify the lead
    const lead = await this.loadLead(supabase, userId, input.leadId);

    // 1a. One active booking per lead — refuse a duplicate so callers update
    // the existing one instead. Cancelled bookings don't block a fresh one.
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, booking_ref")
      .eq("user_id", userId)
      .eq("lead_id", lead.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      throw new Error(`BOOKING_EXISTS:${(existing as { id: string }).id}`);
    }

    // 2. Reference number (per-user serial + creation year)
    const { data: serialData } = await supabase
      .rpc("next_booking_serial", { p_user_id: userId })
      .single<number>();
    const bookingSerial = typeof serialData === "number" ? serialData : 1;
    const year = new Date(input.scheduledAt).getFullYear();
    const bookingRef = composeBookingRef(bookingSerial, year);

    // 3. Order snapshot
    const qty = lead.product_qty ?? 1;
    const unitPrice = input.unitPrice ?? null;
    const totalAmount = unitPrice !== null ? Number((unitPrice * qty).toFixed(2)) : null;
    const product = lead.product_model ?? "Water purifier";

    // 4. Insert booking (status 'scheduled')
    const { data: booking, error: insertErr } = await supabase
      .from("bookings")
      .insert({
        user_id: userId,
        lead_id: lead.id,
        booking_serial: bookingSerial,
        booking_ref: bookingRef,
        type: "installation",
        scheduled_at: input.scheduledAt,
        slot_label: input.slotLabel?.trim() || null,
        product_snapshot: product,
        qty_snapshot: qty,
        unit_price: unitPrice,
        currency: "SAR",
        total_amount: totalAmount,
        address_snapshot: lead.location_address ?? null,
        technician: input.technician?.trim() || null,
        technician_id: input.technicianId ?? null,
        slot_id: input.slotId ?? null,
        notes: input.notes?.trim() || null,
        status: "scheduled",
      })
      .select("*")
      .single();

    if (insertErr || !booking) {
      throw new Error(`Failed to create booking: ${insertErr?.message}`);
    }

    // 4a. Claim the availability slot (race-safe). Roll back if already taken.
    if (input.slotId) {
      const claimed = await this.claimSlot(supabase, userId, input.slotId, booking.id);
      if (!claimed) {
        await supabase.from("bookings").delete().eq("id", booking.id);
        throw new Error("SLOT_TAKEN");
      }
    }

    // 5. Flip the lead to 'scheduled' + record the installation date.
    await this.markLeadScheduled(supabase, lead.id, input.scheduledAt);

    // 6 + 7. Build the confirmation text and (optionally) auto-send.
    const fields = this.buildFields({
      clientName: lead.client_name,
      bookingRef,
      product,
      qty,
      totalAmount,
      scheduledAt: input.scheduledAt,
      slotLabel: input.slotLabel ?? null,
    });
    const confirmation = await this.finalizeConfirmation(supabase, userId, lead, booking.id, fields);

    return { booking, ...confirmation };
  }

  /**
   * Updates an existing booking in place (reschedule / price / technician),
   * re-snapshotting product + qty from the current lead and regenerating the
   * confirmation text. Keeps the original booking_ref.
   *
   * @throws "BOOKING_NOT_FOUND", "LEAD_NOT_FOUND", "LEAD_NO_PHONE"
   */
  async updateBookingAndConfirm(
    userId: string,
    bookingId: string,
    input: Omit<CreateBookingInput, "leadId"> & { status?: BookingStatus }
  ): Promise<CreateBookingResult> {
    const supabase = createAdminClient();

    const { data: current } = await supabase
      .from("bookings")
      .select("id, lead_id, booking_ref, slot_id")
      .eq("id", bookingId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!current) throw new Error("BOOKING_NOT_FOUND");
    const cur = current as { id: string; lead_id: string; booking_ref: string; slot_id: string | null };

    const lead = await this.loadLead(supabase, userId, cur.lead_id);

    const qty = lead.product_qty ?? 1;
    const unitPrice = input.unitPrice ?? null;
    const totalAmount = unitPrice !== null ? Number((unitPrice * qty).toFixed(2)) : null;
    const product = lead.product_model ?? "Water purifier";

    // Slot transitions: free the old slot on cancel, or move to the new slot.
    const cancelling = input.status === "cancelled";
    const oldSlotId = cur.slot_id;
    const newSlotId = input.slotId ?? null;

    if (cancelling) {
      if (oldSlotId) await this.freeSlot(supabase, userId, oldSlotId);
    } else if (newSlotId && newSlotId !== oldSlotId) {
      const claimed = await this.claimSlot(supabase, userId, newSlotId, cur.id);
      if (!claimed) throw new Error("SLOT_TAKEN");
      if (oldSlotId) await this.freeSlot(supabase, userId, oldSlotId);
    }

    const updatePayload: Record<string, unknown> = {
      scheduled_at: input.scheduledAt,
      slot_label: input.slotLabel?.trim() || null,
      product_snapshot: product,
      qty_snapshot: qty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      address_snapshot: lead.location_address ?? null,
      technician: input.technician?.trim() || null,
      notes: input.notes?.trim() || null,
      ...(input.status ? { status: input.status } : {}),
    };
    if (input.technicianId !== undefined) updatePayload.technician_id = input.technicianId;
    if (cancelling) updatePayload.slot_id = null;
    else if (newSlotId) updatePayload.slot_id = newSlotId;

    const { data: booking, error: updateErr } = await supabase
      .from("bookings")
      .update(updatePayload)
      .eq("id", cur.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateErr || !booking) {
      throw new Error(`Failed to update booking: ${updateErr?.message}`);
    }

    await this.markLeadScheduled(supabase, lead.id, input.scheduledAt);

    const fields = this.buildFields({
      clientName: lead.client_name,
      bookingRef: cur.booking_ref,
      product,
      qty,
      totalAmount,
      scheduledAt: input.scheduledAt,
      slotLabel: input.slotLabel ?? null,
    });
    const confirmation = await this.finalizeConfirmation(supabase, userId, lead, booking.id, fields);

    return { booking, ...confirmation };
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  /** Claims a free availability slot for a booking (race-safe). Returns false if taken. */
  private async claimSlot(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    slotId: string,
    bookingId: string
  ): Promise<boolean> {
    const { data } = await supabase
      .from("technician_slots")
      .update({ booking_id: bookingId })
      .eq("id", slotId)
      .eq("user_id", userId)
      .is("booking_id", null)
      .select("id");
    return Array.isArray(data) && data.length > 0;
  }

  /** Releases a slot back to the open pool. */
  private async freeSlot(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    slotId: string
  ): Promise<void> {
    await supabase
      .from("technician_slots")
      .update({ booking_id: null })
      .eq("id", slotId)
      .eq("user_id", userId);
  }

  private async loadLead(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    leadId: string
  ): Promise<LeadRow> {
    const { data: lead, error } = (await supabase
      .from("leads")
      .select(
        "id, user_id, client_name, client_phone, product_model, product_qty, location_address, whatsapp_conversation_id"
      )
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle()) as { data: LeadRow | null; error: { message: string } | null };

    if (error) throw new Error(error.message);
    if (!lead) throw new Error("LEAD_NOT_FOUND");
    // No phone check here — a phone is only needed to SEND a WhatsApp
    // confirmation (best-effort/optional). Booking itself doesn't require it,
    // so Messenger leads (which have no phone) can still be scheduled.
    return lead;
  }

  private async markLeadScheduled(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    leadId: string,
    scheduledAt: string
  ): Promise<void> {
    await supabase
      .from("leads")
      .update({ status: "scheduled", installation_date: scheduledAt.slice(0, 10) })
      .eq("id", leadId);
  }

  private buildFields(params: {
    clientName: string;
    bookingRef: string;
    product: string;
    qty: number;
    totalAmount: number | null;
    scheduledAt: string;
    slotLabel: string | null;
  }): BookingMessageFields {
    return {
      clientName: params.clientName,
      bookingRef: params.bookingRef,
      product: params.product,
      qty: params.qty,
      totalFormatted:
        params.totalAmount !== null ? params.totalAmount.toLocaleString("en-US") : "—",
      currency: "SAR",
      dateFormatted: formatBookingDate(params.scheduledAt),
      timeFormatted: params.slotLabel?.trim() || formatBookingTime(params.scheduledAt),
    };
  }

  /**
   * Builds the confirmation text and, when auto-send is enabled, delivers it
   * over WhatsApp (best-effort) and records the outcome on the booking row.
   */
  private async finalizeConfirmation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    lead: LeadRow,
    bookingId: string,
    fields: BookingMessageFields
  ): Promise<{
    confirmationText: string;
    confirmationSent: boolean;
    deliveryMethod: "template" | "free_text" | null;
    confirmationError: string | null;
  }> {
    const confirmationText = buildBookingFreeText(fields);
    let confirmationSent = false;
    let deliveryMethod: "template" | "free_text" | null = null;
    let confirmationError: string | null = null;

    if (BOOKING_WHATSAPP_AUTOSEND) {
      const confirmation = await this.sendConfirmation(supabase, userId, lead, fields);
      confirmationSent = Boolean(confirmation.messageId);
      deliveryMethod = confirmation.method;
      confirmationError = confirmation.error;

      await supabase
        .from("bookings")
        .update({
          whatsapp_message_id: confirmation.messageId,
          delivery_method: confirmation.method,
          confirmation_sent_at: confirmation.messageId ? new Date().toISOString() : null,
          confirmation_error: confirmation.error,
        })
        .eq("id", bookingId);
    }

    return { confirmationText, confirmationSent, deliveryMethod, confirmationError };
  }

  /**
   * Picks the delivery path (free text inside the 24h window, template
   * otherwise), sends it, and persists the outbound message into the thread.
   * Never throws — failures are returned so the booking still succeeds.
   */
  private async sendConfirmation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    lead: LeadRow,
    fields: BookingMessageFields
  ): Promise<{
    messageId: string | null;
    method: "template" | "free_text" | null;
    error: string | null;
  }> {
    const phone = lead.client_phone as string;

    // Load WhatsApp credentials
    const { data: credsRow } = (await supabase
      .from("platform_credentials")
      .select("credentials")
      .eq("user_id", userId)
      .eq("platform", "whatsapp")
      .eq("is_active", true)
      .maybeSingle()) as { data: PlatformCredentialsRow | null };

    if (!credsRow) {
      return {
        messageId: null,
        method: null,
        error: "WhatsApp is not connected. Connect it in Settings to send confirmations.",
      };
    }

    const wa = new WhatsAppService(credsRow.credentials);
    const windowOpen = await this.isServiceWindowOpen(supabase, lead.whatsapp_conversation_id);
    const method: "template" | "free_text" = windowOpen ? "free_text" : "template";

    try {
      let messageId: string;
      if (method === "free_text") {
        const body = buildBookingFreeText(fields);
        const sent = await wa.sendTextMessage(phone, body);
        messageId = sent.messageId;
        await this.persistOutbound(supabase, userId, phone, lead.whatsapp_conversation_id, {
          messageId,
          messageType: "text",
          body,
        });
      } else {
        const components = buildBookingTemplateComponents(fields);
        const sent = await wa.sendTemplateMessage(
          phone,
          BOOKING_TEMPLATE_NAME,
          BOOKING_TEMPLATE_LANGUAGE,
          components
        );
        messageId = sent.messageId;
        await this.persistOutbound(supabase, userId, phone, lead.whatsapp_conversation_id, {
          messageId,
          messageType: "template",
          body: buildBookingFreeText(fields), // store readable copy in the thread
        });
      }
      return { messageId, method, error: null };
    } catch (err) {
      const error =
        err instanceof WhatsAppApiError
          ? `${err.message}${method === "template" ? " (is the 'booking_confirmation' template approved?)" : ""}`
          : err instanceof Error
            ? err.message
            : "Failed to send WhatsApp confirmation";
      console.error("Booking confirmation send failed", { leadId: lead.id, method, err });
      return { messageId: null, method, error };
    }
  }

  /**
   * Returns true if the customer messaged us within the last 24h, meaning
   * free-form text is permitted. No conversation / no inbound → window closed.
   */
  private async isServiceWindowOpen(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    conversationId: string | null
  ): Promise<boolean> {
    if (!conversationId) return false;

    const { data } = (await supabase
      .from("whatsapp_messages")
      .select("sent_at, created_at")
      .eq("conversation_id", conversationId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { sent_at: string | null; created_at: string } | null };

    if (!data) return false;
    const last = new Date(data.sent_at ?? data.created_at).getTime();
    return Date.now() - last < SERVICE_WINDOW_MS;
  }

  /**
   * Persists an outbound confirmation into the conversation thread so it shows
   * up in the WhatsApp inbox. Upserts the conversation by phone if needed.
   */
  private async persistOutbound(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    phone: string,
    conversationId: string | null,
    msg: { messageId: string; messageType: "text" | "template"; body: string }
  ): Promise<void> {
    const contactPhone = phone.startsWith("+") ? phone : `+${phone}`;
    let convId = conversationId;

    if (!convId) {
      const { data: conv } = (await supabase
        .from("whatsapp_conversations")
        .upsert(
          {
            user_id: userId,
            contact_phone: contactPhone,
            last_message_at: new Date().toISOString(),
            last_message_preview: msg.body.slice(0, 200),
          },
          { onConflict: "user_id,contact_phone" }
        )
        .select("id")
        .single()) as { data: { id: string } | null };
      convId = conv?.id ?? null;
    }

    if (!convId) return;

    await supabase.from("whatsapp_messages").insert({
      conversation_id: convId,
      user_id: userId,
      wa_message_id: msg.messageId,
      direction: "outbound",
      message_type: msg.messageType,
      body: msg.body,
      status: "sent",
      ai_generated: false,
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: msg.body.slice(0, 200),
      })
      .eq("id", convId);
  }
}
