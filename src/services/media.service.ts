import { createAdminClient } from "@/lib/supabase/admin";
import {
  POST_MEDIA_ALLOWED_MIME_TYPES,
  POST_MEDIA_BUCKET,
  POST_MEDIA_MAX_BYTES,
  buildPostMediaObjectPath,
  isPostMediaTypeAllowed,
  resolveMediaContentType,
} from "@/lib/media-constants";

export class MediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaUploadError";
  }
}

export async function uploadMedia(
  userId: string,
  file: File
): Promise<{ url: string; path: string }> {
  if (!isPostMediaTypeAllowed(file)) {
    const ct = file.type || "(empty)";
    throw new MediaUploadError(
      `Invalid file type: ${ct}. Allowed: ${POST_MEDIA_ALLOWED_MIME_TYPES.join(", ")}`
    );
  }

  const contentType = resolveMediaContentType(file)!;

  if (file.size > POST_MEDIA_MAX_BYTES) {
    throw new MediaUploadError(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 50MB`
    );
  }

  const supabase = createAdminClient();
  const path = buildPostMediaObjectPath(userId, file);

  const { error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new MediaUploadError(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);

  return { url: publicUrl, path };
}

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/amr": "amr",
  "audio/3gpp": "3gp",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
  "application/pdf": "pdf",
};

/**
 * Re-hosts a media buffer (e.g. downloaded from an inbound WhatsApp/Messenger
 * media message) into Supabase Storage and returns its permanent public URL.
 *
 * Unlike `uploadMedia`, this accepts any content type — it's for archiving
 * whatever a customer sent us, not validating an outbound post's media.
 */
export async function uploadMediaBuffer(
  userId: string,
  subfolder: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; path: string }> {
  const supabase = createAdminClient();
  const ext = CONTENT_TYPE_TO_EXT[contentType] ?? "bin";
  const path = `${userId}/${subfolder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    throw new MediaUploadError(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);

  return { url: publicUrl, path };
}
