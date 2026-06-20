import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getTechSession } from "@/lib/tech-auth";
import { BOOKING_PHOTO_BUCKET } from "@/lib/booking-photo-constants";

/**
 * DELETE /api/v1/tech/bookings/[id]/photos/[photoId]
 * Removes a site photo (storage object + row) the technician uploaded for their
 * own booking. Gated by the tech cookie and scoped to the tech's bookings.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getTechSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Not signed in.", 401);
  }

  const { id: bookingId, photoId } = await params;
  const admin = createAdminClient();

  // Scope the lookup to the tech's own booking + owner so they can't delete
  // photos on jobs that aren't theirs.
  const { data: photo } = await admin
    .from("booking_photos")
    .select("id, storage_path, booking:bookings!inner(technician_id)")
    .eq("id", photoId)
    .eq("booking_id", bookingId)
    .eq("user_id", session.uid)
    .maybeSingle<{
      id: string;
      storage_path: string;
      booking: { technician_id: string | null };
    }>();

  if (!photo || photo.booking?.technician_id !== session.tid) {
    return apiError("NOT_FOUND", "Photo not found.", 404);
  }

  await admin.storage.from(BOOKING_PHOTO_BUCKET).remove([photo.storage_path]);
  const { error } = await admin.from("booking_photos").delete().eq("id", photoId);
  if (error) {
    return apiError("DELETE_FAILED", "Could not delete the photo.", 500, error.message);
  }

  return apiSuccess({ deleted: photoId });
}
