import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getTechSession } from "@/lib/tech-auth";
import {
  BOOKING_PHOTO_BUCKET,
  BOOKING_PHOTO_KINDS,
  BOOKING_PHOTO_MAX_BYTES,
  buildBookingPhotoObjectPath,
  isBookingPhotoTypeAllowed,
  resolveBookingPhotoContentType,
  type BookingPhotoKind,
} from "@/lib/booking-photo-constants";

/**
 * POST /api/v1/tech/bookings/[id]/photos
 * Uploads a site photo (multipart: `file`, optional `kind`, optional `caption`)
 * for the technician's own booking. Stores the object in the public
 * booking-photos bucket and records a booking_photos row. Gated by the tech
 * cookie; the booking must be assigned to this technician.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTechSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Not signed in.", 401);
  }

  const { id: bookingId } = await params;
  const admin = createAdminClient();

  // Confirm the booking belongs to this technician before accepting an upload.
  const { data: booking } = await admin
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .maybeSingle();
  if (!booking) {
    return apiError("NOT_FOUND", "Booking not found.", 404);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("INVALID_REQUEST", "Expected a multipart upload.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return apiError("INVALID_REQUEST", "No photo provided.", 400);
  }
  if (!isBookingPhotoTypeAllowed(file)) {
    return apiError("INVALID_TYPE", "Please upload an image (JPG, PNG, WEBP, HEIC).", 400);
  }
  if (file.size > BOOKING_PHOTO_MAX_BYTES) {
    return apiError(
      "FILE_TOO_LARGE",
      `Photo too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum 15MB.`,
      400
    );
  }

  const kindRaw = String(form.get("kind") ?? "other");
  const kind: BookingPhotoKind = (BOOKING_PHOTO_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as BookingPhotoKind)
    : "other";
  const captionRaw = form.get("caption");
  const caption = typeof captionRaw === "string" ? captionRaw.trim().slice(0, 500) || null : null;

  const contentType = resolveBookingPhotoContentType(file)!;
  const timestamp = Date.now();
  const path = buildBookingPhotoObjectPath(session.uid, bookingId, kind, file, timestamp);

  const { error: uploadError } = await admin.storage
    .from(BOOKING_PHOTO_BUCKET)
    .upload(path, file, { contentType, upsert: false });
  if (uploadError) {
    return apiError("UPLOAD_FAILED", "Could not upload the photo.", 500, uploadError.message);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BOOKING_PHOTO_BUCKET).getPublicUrl(path);

  const { data: photo, error: insertError } = await admin
    .from("booking_photos")
    .insert({
      user_id: session.uid,
      booking_id: bookingId,
      technician_id: session.tid,
      storage_path: path,
      url: publicUrl,
      kind,
      caption,
    })
    .select("id, url, kind, caption, created_at")
    .single();

  if (insertError) {
    // Roll back the orphaned object so storage doesn't drift from the table.
    await admin.storage.from(BOOKING_PHOTO_BUCKET).remove([path]);
    return apiError("SAVE_FAILED", "Could not save the photo.", 500, insertError.message);
  }

  return apiSuccess({ photo }, 201);
}
