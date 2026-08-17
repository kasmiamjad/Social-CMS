import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const UpdateFollowupSchema = z.object({
  done: z.boolean(),
});

/** PATCH /api/v1/leads/:leadId/followups/:followupId — mark done/undone. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ leadId: string; followupId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { leadId, followupId } = await context.params;

  let parsed: z.infer<typeof UpdateFollowupSchema>;
  try {
    parsed = UpdateFollowupSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lead_followups")
    .update({ completed_at: parsed.done ? new Date().toISOString() : null })
    .eq("id", followupId)
    .eq("lead_id", leadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) return apiError("UPDATE_FAILED", error.message, 500);
  if (!data) return apiError("NOT_FOUND", "Follow-up not found", 404);

  return apiSuccess({ followup: data });
}

/** DELETE /api/v1/leads/:leadId/followups/:followupId */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ leadId: string; followupId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { leadId, followupId } = await context.params;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lead_followups")
    .delete()
    .eq("id", followupId)
    .eq("lead_id", leadId)
    .eq("user_id", userId);

  if (error) return apiError("DELETE_FAILED", error.message, 500);

  return apiSuccess({ deleted: true });
}
