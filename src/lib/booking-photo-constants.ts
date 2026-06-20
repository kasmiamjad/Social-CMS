/** Supabase Storage bucket for technician site photos (before/after a job). */
export const BOOKING_PHOTO_BUCKET = "booking-photos";

/** Photo categories a technician can tag an upload with. */
export const BOOKING_PHOTO_KINDS = ["before", "after", "other"] as const;
export type BookingPhotoKind = (typeof BOOKING_PHOTO_KINDS)[number];

/** Images only — phone camera captures. HEIC/HEIF included for iPhone uploads. */
export const BOOKING_PHOTO_ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const BOOKING_PHOTO_MAX_BYTES = 15 * 1024 * 1024; // 15MB

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/**
 * Resolves a storage Content-Type, falling back to the file extension when the
 * browser leaves `file.type` empty (common for camera / filesystem picks).
 */
export function resolveBookingPhotoContentType(file: File): string | null {
  if (file.type && BOOKING_PHOTO_ALLOWED_MIME_TYPES.includes(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  return EXT_TO_MIME[lower.slice(dot)] ?? null;
}

export function isBookingPhotoTypeAllowed(file: File): boolean {
  return resolveBookingPhotoContentType(file) !== null;
}

function sanitizeFilename(filename: string): string {
  return (filename || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Object path: {user_id}/{booking_id}/{kind}_{timestamp}_{filename}. */
export function buildBookingPhotoObjectPath(
  userId: string,
  bookingId: string,
  kind: BookingPhotoKind,
  file: File,
  timestamp: number
): string {
  const name = sanitizeFilename(file.name || "photo");
  return `${userId}/${bookingId}/${kind}_${timestamp}_${name}`;
}
