import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

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
