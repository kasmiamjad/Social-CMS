import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { BookingService } from "@/services/booking/booking.service";

const CreateBookingSchema = z.object({
  lead_id: z.string().uuid(),
  scheduled_at: z.string().datetime({ offset: true }),
  slot_label: z.string().max(60).optional().nullable(),
  unit_price: z.number().min(0).max(9_999_999).optional().nullable(),
  technician: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  technician_id: z.string().uuid().optional().nullable(),
  slot_id: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/v1/bookings
 *
 * List bookings for the authenticated user. Filters:
 *   ?status=scheduled
 *   ?lead_id=<uuid>
 *   ?limit=100&offset=0
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const leadId = url.searchParams.get("lead_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

  const supabase = createAdminClient();
  let query = supabase
    .from("bookings")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (leadId) query = query.eq("lead_id", leadId);

  const { data, count, error } = await query;
  if (error) return apiError("LOAD_FAILED", error.message, 500);

  return apiSuccess({ bookings: data ?? [], total: count ?? 0, limit, offset });
}

/**
 * POST /api/v1/bookings
 *
 * Convert a lead into a confirmed installation booking and notify the customer
 * over WhatsApp. The booking is always created; the WhatsApp confirmation is
 * best-effort — its outcome is reported in the response so the UI can warn if
 * delivery failed (e.g. template not yet approved).
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let parsed: z.infer<typeof CreateBookingSchema>;
  try {
    parsed = CreateBookingSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const service = new BookingService();
  try {
    const result = await service.createBookingAndConfirm(userId, {
      leadId: parsed.lead_id,
      scheduledAt: parsed.scheduled_at,
      slotLabel: parsed.slot_label,
      unitPrice: parsed.unit_price,
      technician: parsed.technician,
      notes: parsed.notes,
      technicianId: parsed.technician_id,
      slotId: parsed.slot_id,
    });

    return apiSuccess({
      booking: result.booking,
      confirmation_text: result.confirmationText,
      confirmation_sent: result.confirmationSent,
      delivery_method: result.deliveryMethod,
      confirmation_error: result.confirmationError,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "LEAD_NOT_FOUND") return apiError("NOT_FOUND", "Lead not found", 404);
    if (msg === "LEAD_NO_PHONE") {
      return apiError(
        "LEAD_NO_PHONE",
        "This lead has no phone number — add one before booking.",
        400
      );
    }
    if (msg.startsWith("BOOKING_EXISTS:")) {
      return apiError(
        "BOOKING_EXISTS",
        "This lead already has a booking. Refresh the page to edit it instead of creating a new one.",
        409,
        { booking_id: msg.slice("BOOKING_EXISTS:".length) }
      );
    }
    if (msg === "SLOT_TAKEN") {
      return apiError("SLOT_TAKEN", "That slot was just taken — pick another open slot.", 409);
    }
    return apiError("CREATE_FAILED", msg, 500);
  }
}
