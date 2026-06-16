import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { MessengerService, MessengerApiError } from "@/services/platforms/messenger/messenger.service";
import type { MessengerCredentials } from "@/services/platforms/messenger/messenger.types";

const SendSchema = z.object({ body: z.string().min(1).max(2000) });

interface ConvRow {
  id: string;
  psid: string;
  contact_name: string | null;
}

/**
 * GET /api/v1/messenger/conversations/:conversationId/messages
 * Returns the conversation header + messages (oldest → newest).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { conversationId } = await context.params;

  const supabase = createAdminClient();
  const { data: conv } = await supabase
    .from("messenger_conversations")
    .select("id, psid, contact_name")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: messages } = await supabase
    .from("messenger_messages")
    .select("id, direction, message_type, body, ai_generated, status, sent_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return apiSuccess({
    channel: "messenger",
    contact_name: conv.contact_name,
    contact: conv.psid,
    messages: messages ?? [],
  });
}

/**
 * POST /api/v1/messenger/conversations/:conversationId/messages
 * Sends a manual text reply to the customer and persists it.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { conversationId } = await context.params;

  let parsed: z.infer<typeof SendSchema>;
  try {
    parsed = SendSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();
  const { data: conv } = await supabase
    .from("messenger_conversations")
    .select("id, psid, contact_name")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: credsRow } = await supabase
    .from("platform_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "messenger")
    .eq("is_active", true)
    .maybeSingle<{ credentials: MessengerCredentials }>();

  if (!credsRow) {
    return apiError("MESSENGER_NOT_CONNECTED", "Connect Facebook Messenger in Settings first.", 400);
  }

  const messenger = new MessengerService(credsRow.credentials);
  try {
    const sent = await messenger.sendTextMessage(conv.psid, parsed.body);

    const { data: message } = await supabase
      .from("messenger_messages")
      .insert({
        conversation_id: conv.id,
        user_id: userId,
        mid: sent.messageId,
        direction: "outbound",
        message_type: "text",
        body: parsed.body,
        status: "sent",
        ai_generated: false,
        sent_at: new Date().toISOString(),
      })
      .select("id, direction, message_type, body, ai_generated, status, sent_at, created_at")
      .single();

    await supabase
      .from("messenger_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: parsed.body.slice(0, 200),
      })
      .eq("id", conv.id);

    return apiSuccess({ message });
  } catch (err) {
    if (err instanceof MessengerApiError) {
      return apiError("MESSENGER_API_ERROR", err.message, err.statusCode, err.apiError);
    }
    return apiError("SEND_FAILED", err instanceof Error ? err.message : "Send failed", 500);
  }
}
