import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const CreateFollowupSchema = z.object({
  follow_up_date: z.string().min(1),
  note: z.string().max(2000).optional().nullable(),
  logged_by: z.string().max(100).optional().nullable(),
});

/** GET /api/v1/leads/:leadId/followups — list follow-ups for a lead, most recent first. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { leadId } = await context.params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lead_followups")
    .select("*")
    .eq("lead_id", leadId)
    .eq("user_id", userId)
    .order("follow_up_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return apiError("LOAD_FAILED", error.message, 500);

  return apiSuccess({ followups: data ?? [] });
}

/** POST /api/v1/leads/:leadId/followups — log a new follow-up entry. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { leadId } = await context.params;

  let parsed: z.infer<typeof CreateFollowupSchema>;
  try {
    parsed = CreateFollowupSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();

  // Confirm the lead belongs to this tenant before attaching a follow-up to it.
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!lead) return apiError("NOT_FOUND", "Lead not found", 404);

  const { data, error } = await supabase
    .from("lead_followups")
    .insert({
      user_id: userId,
      lead_id: leadId,
      follow_up_date: parsed.follow_up_date,
      note: parsed.note ?? null,
      logged_by: parsed.logged_by ?? null,
    })
    .select("*")
    .single();

  if (error) return apiError("CREATE_FAILED", error.message, 500);

  return apiSuccess({ followup: data });
}
