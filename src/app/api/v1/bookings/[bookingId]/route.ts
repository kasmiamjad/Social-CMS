import { type NextRequest } from "next/server";
import { z } from "zod";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { BookingService } from "@/services/booking/booking.service";

const UpdateBookingSchema = z.object({
  scheduled_at: z.string().datetime({ offset: true }),
  slot_label: z.string().max(60).optional().nullable(),
  unit_price: z.number().min(0).max(9_999_999).optional().nullable(),
  technician: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]).optional(),
});

/**
 * PATCH /api/v1/bookings/:bookingId
 *
 * Update an existing booking (reschedule / price / technician / status) and
 * regenerate the customer confirmation text. Keeps the original booking_ref.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { bookingId } = await context.params;

  let parsed: z.infer<typeof UpdateBookingSchema>;
  try {
    parsed = UpdateBookingSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const service = new BookingService();
  try {
    const result = await service.updateBookingAndConfirm(userId, bookingId, {
      scheduledAt: parsed.scheduled_at,
      slotLabel: parsed.slot_label,
      unitPrice: parsed.unit_price,
      technician: parsed.technician,
      notes: parsed.notes,
      status: parsed.status,
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
    if (msg === "BOOKING_NOT_FOUND") return apiError("NOT_FOUND", "Booking not found", 404);
    if (msg === "LEAD_NOT_FOUND") return apiError("NOT_FOUND", "Lead not found", 404);
    if (msg === "LEAD_NO_PHONE") {
      return apiError("LEAD_NO_PHONE", "This lead has no phone number.", 400);
    }
    return apiError("UPDATE_FAILED", msg, 500);
  }
}
