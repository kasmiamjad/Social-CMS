import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { uploadMedia, MediaUploadError } from "@/services/media.service";

/** POST /api/v1/reply-templates/:templateId/image — attach an image (multipart: file). */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { templateId } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("INVALID_REQUEST", "Expected multipart/form-data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("INVALID_REQUEST", "Missing 'file'", 400);
  }
  if (!file.type.startsWith("image/")) {
    return apiError("INVALID_REQUEST", "File must be an image", 400);
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();

  const { data: existing } = await supabase
    .from("reply_templates")
    .select("id")
    .eq("id", templateId)
    .eq("user_id", tenantId)
    .maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Template not found", 404);

  try {
    const { url } = await uploadMedia(tenantId, file);

    const { data, error } = await supabase
      .from("reply_templates")
      .update({ media_url: url })
      .eq("id", templateId)
      .eq("user_id", tenantId)
      .select("*")
      .single();

    if (error) return apiError("UPDATE_FAILED", error.message, 500);

    return apiSuccess({ template: data });
  } catch (err) {
    if (err instanceof MediaUploadError) return apiError("UPLOAD_FAILED", err.message, 400);
    return apiError("UNEXPECTED_ERROR", err instanceof Error ? err.message : "Unknown error", 500);
  }
}

/** DELETE /api/v1/reply-templates/:templateId/image — remove the attached image. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { templateId } = await context.params;

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data, error } = await supabase
    .from("reply_templates")
    .update({ media_url: null })
    .eq("id", templateId)
    .eq("user_id", tenantId)
    .select("*")
    .single();

  if (error) return apiError("UPDATE_FAILED", error.message, 500);
  if (!data) return apiError("NOT_FOUND", "Template not found", 404);

  return apiSuccess({ template: data });
}
