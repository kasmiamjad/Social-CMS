import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";
import { BookingService } from "@/services/booking/booking.service";
import { defaultPriceForModel } from "@/lib/products";
import { formatBookingDate } from "@/services/booking/booking.constants";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const BookSchema = z.object({
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(TIME_RE),
  end_time: z.string().regex(TIME_RE),
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(40),
  address: z.string().max(500).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** "12:00:00" → "12:00 PM". */
function fmtTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

/**
 * POST /api/v1/book/:token
 *
 * PUBLIC (token-gated). The customer picks a date + time; we claim any free slot
 * at that time (any active technician) and create/update their booking.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  let parsed: z.infer<typeof BookSchema>;
  try {
    parsed = BookSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("leads")
    .select("id, user_id, product_model")
    .eq("booking_token", token)
    .maybeSingle<{ id: string; user_id: string; product_model: string | null }>();
  if (!lead) return apiError("NOT_FOUND", "Invalid link", 404);

  // Active technicians, then a free slot at the requested time (any of them).
  const { data: techs } = await admin
    .from("technicians")
    .select("id, name")
    .eq("user_id", lead.user_id)
    .eq("is_active", true);
  const techIds = (techs ?? []).map((t) => (t as { id: string }).id);
  if (techIds.length === 0) return apiError("NO_AVAILABILITY", "No technicians available.", 409);

  const { data: slot } = await admin
    .from("technician_slots")
    .select("id, technician_id, start_time, end_time")
    .eq("user_id", lead.user_id)
    .in("technician_id", techIds)
    .eq("slot_date", parsed.slot_date)
    .eq("start_time", parsed.start_time.length === 5 ? `${parsed.start_time}:00` : parsed.start_time)
    .is("booking_id", null)
    .limit(1)
    .maybeSingle<{ id: string; technician_id: string; start_time: string; end_time: string }>();

  if (!slot) {
    return apiError("SLOT_TAKEN", "That time was just taken — please pick another.", 409);
  }

  // Save the customer's confirmed details + GPS location onto the lead first,
  // so the booking snapshot + technician get the right address.
  await admin
    .from("leads")
    .update({
      client_name: parsed.name.trim(),
      client_phone: parsed.phone.trim(),
      location_lat: parsed.lat,
      location_lng: parsed.lng,
      location_url: `https://www.google.com/maps/search/?api=1&query=${parsed.lat},${parsed.lng}`,
      location_address: parsed.address?.trim() || null,
    })
    .eq("id", lead.id);

  const techName =
    (techs ?? []).find((t) => (t as { id: string }).id === slot.technician_id)?.name ?? null;
  const scheduledAt = `${parsed.slot_date}T${slot.start_time}+03:00`;
  const slotLabel = `${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)}`;
  const unitPrice = defaultPriceForModel(lead.product_model);

  const service = new BookingService();
  try {
    // Reschedule if the lead already has an active booking; otherwise create.
    const { data: existing } = await admin
      .from("bookings")
      .select("id")
      .eq("user_id", lead.user_id)
      .eq("lead_id", lead.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    const bookingInput = {
      scheduledAt,
      slotLabel,
      unitPrice,
      technician: techName,
      technicianId: slot.technician_id,
      slotId: slot.id,
      notes: null as string | null,
    };

    const result = existing
      ? await service.updateBookingAndConfirm(lead.user_id, existing.id, bookingInput)
      : await service.createBookingAndConfirm(lead.user_id, { leadId: lead.id, ...bookingInput });

    return apiSuccess({
      booking_ref: (result.booking as { booking_ref?: string }).booking_ref ?? null,
      date: formatBookingDate(scheduledAt),
      time: slotLabel,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Public booking failed", { token, msg, err });
    if (msg === "SLOT_TAKEN") {
      return apiError("SLOT_TAKEN", "That time was just taken — please pick another.", 409);
    }
    return apiError("BOOK_FAILED", "Could not complete the booking. Please try again.", 500);
  }
}
