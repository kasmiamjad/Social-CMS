import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const VALID_SLUGS = ["dispenser", "ro_699", "ro_uv_999", "smart_ro_1199", "smart_ro_1299"] as const;
type ProductSlug = (typeof VALID_SLUGS)[number];

const STORAGE_BUCKET = "post-media";

/**
 * GET /api/v1/whatsapp/product-images
 * Returns the current product_images map for the user.
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_automation_configs")
    .select("product_images")
    .eq("user_id", userId)
    .maybeSingle<{ product_images: Record<string, string> }>();

  if (error) return apiError("LOAD_FAILED", error.message, 500);

  return apiSuccess({ images: (data?.product_images ?? {}) as Record<string, string> });
}

/**
 * POST /api/v1/whatsapp/product-images
 * Accepts multipart/form-data with `file` (image) and `slug` (product key).
 * Uploads to Supabase Storage, saves the public URL to the DB.
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("INVALID_REQUEST", "Expected multipart/form-data", 400);
  }

  const file = formData.get("file") as File | null;
  const slug = formData.get("slug") as string | null;

  if (!file || !slug) {
    return apiError("INVALID_REQUEST", "Both file and slug are required", 400);
  }
  if (!(VALID_SLUGS as readonly string[]).includes(slug)) {
    return apiError("INVALID_REQUEST", `slug must be one of: ${VALID_SLUGS.join(", ")}`, 400);
  }
  if (!file.type.startsWith("image/")) {
    return apiError("INVALID_REQUEST", "File must be an image", 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return apiError("INVALID_REQUEST", "Image must be under 5 MB", 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `product-images/${userId}/${slug}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return apiError("UPLOAD_FAILED", uploadError.message, 500);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  // Merge the new URL into the existing product_images map
  const { data: existing } = await supabase
    .from("whatsapp_automation_configs")
    .select("product_images")
    .eq("user_id", userId)
    .maybeSingle<{ product_images: Record<string, string> }>();

  const updatedImages: Record<string, string> = {
    ...(existing?.product_images ?? {}),
    [slug as ProductSlug]: publicUrl,
  };

  // Update if row exists, insert minimal row if not
  const { data: updated } = await supabase
    .from("whatsapp_automation_configs")
    .update({ product_images: updatedImages })
    .eq("user_id", userId)
    .select("user_id");

  if (!updated || updated.length === 0) {
    await supabase.from("whatsapp_automation_configs").insert({
      user_id: userId,
      product_images: updatedImages,
    });
  }

  return apiSuccess({ url: publicUrl, slug });
}

/**
 * DELETE /api/v1/whatsapp/product-images?slug=xxx
 * Removes a product image URL from the DB (does not delete the Storage file).
 */
export async function DELETE(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug || !(VALID_SLUGS as readonly string[]).includes(slug)) {
    return apiError("INVALID_REQUEST", "Valid slug query param required", 400);
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("whatsapp_automation_configs")
    .select("product_images")
    .eq("user_id", userId)
    .maybeSingle<{ product_images: Record<string, string> }>();

  const updatedImages = { ...(existing?.product_images ?? {}) };
  delete updatedImages[slug];

  await supabase
    .from("whatsapp_automation_configs")
    .update({ product_images: updatedImages })
    .eq("user_id", userId);

  return apiSuccess({ removed: slug });
}
