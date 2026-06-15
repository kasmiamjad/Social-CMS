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

export interface CreateBookingInput {
  leadId: string;
  /** ISO timestamp for the scheduled installation. */
  scheduledAt: string;
  /** Optional friendly slot ("Morning 9–12"); shown instead of the time if set. */
  slotLabel?: string | null;
  unitPrice?: number | null;
  technician?: string | null;
  notes?: string | null;
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
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select(
        "id, user_id, client_name, client_phone, product_model, product_qty, location_address, whatsapp_conversation_id"
      )
      .eq("id", input.leadId)
      .eq("user_id", userId)
      .maybeSingle<LeadRow>();

    if (leadErr) throw new Error(leadErr.message);
    if (!lead) throw new Error("LEAD_NOT_FOUND");
    if (!lead.client_phone?.trim()) throw new Error("LEAD_NO_PHONE");

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
        notes: input.notes?.trim() || null,
        status: "scheduled",
      })
      .select("*")
      .single();

    if (insertErr || !booking) {
      throw new Error(`Failed to create booking: ${insertErr?.message}`);
    }

    // 5. Flip the lead to 'scheduled' + record the installation date.
    await supabase
      .from("leads")
      .update({
        status: "scheduled",
        installation_date: input.scheduledAt.slice(0, 10),
      })
      .eq("id", lead.id);

    // 6. Build the customer confirmation text (always returned for copy-paste).
    const fields: BookingMessageFields = {
      clientName: lead.client_name,
      bookingRef,
      product,
      qty,
      totalFormatted:
        totalAmount !== null ? totalAmount.toLocaleString("en-US") : "—",
      currency: "SAR",
      dateFormatted: formatBookingDate(input.scheduledAt),
      timeFormatted: input.slotLabel?.trim() || formatBookingTime(input.scheduledAt),
    };
    const confirmationText = buildBookingFreeText(fields);

    // 7. Auto-send over WhatsApp only when enabled (paused until the template
    // is approved — see BOOKING_WHATSAPP_AUTOSEND). Send is best-effort.
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
        .eq("id", booking.id);
    }

    return {
      booking,
      confirmationText,
      confirmationSent,
      deliveryMethod,
      confirmationError,
    };
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
