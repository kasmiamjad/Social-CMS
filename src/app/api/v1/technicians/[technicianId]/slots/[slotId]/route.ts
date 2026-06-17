import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

/**
 * DELETE /api/v1/technicians/:technicianId/slots/:slotId
 * Removes a free availability slot. Booked slots can't be deleted — cancel or
 * reschedule the booking first.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ technicianId: string; slotId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { slotId } = await context.params;

  const supabase = createAdminClient();
  const { data: slot } = await supabase
    .from("technician_slots")
    .select("id, booking_id")
    .eq("id", slotId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; booking_id: string | null }>();

  if (!slot) return apiError("NOT_FOUND", "Slot not found", 404);
  if (slot.booking_id) {
    return apiError("SLOT_BOOKED", "This slot is booked — cancel/reschedule the booking first.", 409);
  }

  const { error } = await supabase
    .from("technician_slots")
    .delete()
    .eq("id", slotId)
    .eq("user_id", userId);

  if (error) return apiError("DELETE_FAILED", error.message, 500);
  return apiSuccess({ deleted: true });
}
