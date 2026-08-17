import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const SHORTCUT_RE = /^[a-z0-9_-]{1,40}$/;

const UpdateTemplateSchema = z.object({
  shortcut: z.string().regex(SHORTCUT_RE, "Lowercase letters, numbers, - and _ only").optional(),
  message: z.string().min(1).max(4096).optional(),
});

/** PATCH /api/v1/reply-templates/:templateId */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { templateId } = await context.params;

  let parsed: z.infer<typeof UpdateTemplateSchema>;
  try {
    parsed = UpdateTemplateSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const payload: Record<string, unknown> = {};
  if (parsed.shortcut !== undefined) payload.shortcut = parsed.shortcut;
  if (parsed.message !== undefined) payload.message = parsed.message;
  if (Object.keys(payload).length === 0) {
    return apiError("NO_CHANGES", "Provide at least one field to update.", 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reply_templates")
    .update(payload)
    .eq("id", templateId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return apiError("DUPLICATE", "A template with that shortcut already exists", 409);
    }
    return apiError("UPDATE_FAILED", error.message, 500);
  }
  if (!data) return apiError("NOT_FOUND", "Template not found", 404);

  return apiSuccess({ template: data });
}

/** DELETE /api/v1/reply-templates/:templateId */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { templateId } = await context.params;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reply_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", userId);

  if (error) return apiError("DELETE_FAILED", error.message, 500);

  return apiSuccess({ deleted: true });
}
