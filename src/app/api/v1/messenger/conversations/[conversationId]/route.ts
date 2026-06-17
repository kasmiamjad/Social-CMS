import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const UpdateConversationSchema = z.object({
  ai_paused: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

/** GET /api/v1/messenger/conversations/[conversationId] */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { conversationId } = await context.params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messenger_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return apiError("LOAD_FAILED", error.message, 500);
  if (!data) return apiError("NOT_FOUND", "Conversation not found", 404);

  return apiSuccess({ conversation: data });
}

/**
 * PATCH /api/v1/messenger/conversations/[conversationId]
 * Updates per-conversation flags (ai_paused, is_archived).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { conversationId } = await context.params;

  let parsed: z.infer<typeof UpdateConversationSchema>;
  try {
    parsed = UpdateConversationSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();

  const payload: Record<string, unknown> = {};
  if (typeof parsed.ai_paused === "boolean") payload.ai_paused = parsed.ai_paused;
  if (typeof parsed.is_archived === "boolean") payload.is_archived = parsed.is_archived;

  if (Object.keys(payload).length === 0) {
    return apiError("NO_CHANGES", "Provide at least one field to update.", 400);
  }

  const { data, error } = await supabase
    .from("messenger_conversations")
    .update(payload)
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) return apiError("UPDATE_FAILED", error.message, 500);

  return apiSuccess({ conversation: data });
}
