import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getTechSession } from "@/lib/tech-auth";
import { BOOKING_PHOTO_BUCKET } from "@/lib/booking-photo-constants";

const CaptionSchema = z.object({
  caption: z.string().trim().max(500).nullable().optional(),
});

/**
 * Loads a photo scoped to the signed-in technician's own booking, returning null
 * if it isn't theirs. Shared by PATCH (caption) and DELETE.
 */
async function findOwnPhoto(
  admin: ReturnType<typeof createAdminClient>,
  uid: string,
  tid: string,
  bookingId: string,
  photoId: string
) {
  const { data } = await admin
    .from("booking_photos")
    .select("id, storage_path, booking:bookings!inner(technician_id)")
    .eq("id", photoId)
    .eq("booking_id", bookingId)
    .eq("user_id", uid)
    .maybeSingle<{
      id: string;
      storage_path: string;
      booking: { technician_id: string | null };
    }>();
  if (!data || data.booking?.technician_id !== tid) return null;
  return data;
}

/**
 * PATCH /api/v1/tech/bookings/[id]/photos/[photoId]
 * Updates a photo's caption. Scoped to the tech's own booking.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getTechSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Not signed in.", 401);
  }

  let parsed: z.infer<typeof CaptionSchema>;
  try {
    parsed = CaptionSchema.parse(await request.json());
  } catch {
    return apiError("INVALID_REQUEST", "Invalid caption.", 400);
  }

  const { id: bookingId, photoId } = await params;
  const admin = createAdminClient();

  const photo = await findOwnPhoto(admin, session.uid, session.tid, bookingId, photoId);
  if (!photo) {
    return apiError("NOT_FOUND", "Photo not found.", 404);
  }

  const { data: updated, error } = await admin
    .from("booking_photos")
    .update({ caption: parsed.caption?.trim() || null })
    .eq("id", photoId)
    .select("id, url, kind, caption, created_at")
    .single();

  if (error) {
    return apiError("UPDATE_FAILED", "Could not save the caption.", 500, error.message);
  }
  return apiSuccess({ photo: updated });
}

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

  const photo = await findOwnPhoto(admin, session.uid, session.tid, bookingId, photoId);
  if (!photo) {
    return apiError("NOT_FOUND", "Photo not found.", 404);
  }

  await admin.storage.from(BOOKING_PHOTO_BUCKET).remove([photo.storage_path]);
  const { error } = await admin.from("booking_photos").delete().eq("id", photoId);
  if (error) {
    return apiError("DELETE_FAILED", "Could not delete the photo.", 500, error.message);
  }

  return apiSuccess({ deleted: photoId });
}
