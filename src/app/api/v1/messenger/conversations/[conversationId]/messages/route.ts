import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { MessengerService, MessengerApiError } from "@/services/platforms/messenger/messenger.service";
import type { MessengerCredentials } from "@/services/platforms/messenger/messenger.types";

const SendSchema = z
  .object({
    body: z.string().max(2000).optional(),
    media_url: z.string().url().optional(),
  })
  .refine((d) => (d.body && d.body.trim()) || d.media_url, "body or media_url is required");

interface ConvRow {
  id: string;
  psid: string;
  contact_name: string | null;
}

interface ConvRowWithSync extends ConvRow {
  last_synced_at: string | null;
}

/** Don't re-hit the Conversations API more than once per this window (the chat drawer polls every 5s). */
const SYNC_THROTTLE_MS = 15_000;

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
  const tenantId = getTenantId();
  const { data: conv } = await supabase
    .from("messenger_conversations")
    .select("id, psid, contact_name, last_synced_at")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<ConvRowWithSync>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  // Best-effort reconciliation with Meta's Conversations API — catches
  // replies sent from Meta's own Business Inbox, which don't reliably arrive
  // as webhook echoes. Throttled so the chat drawer's 5s poll doesn't hammer
  // the Graph API.
  const lastSynced = conv.last_synced_at ? new Date(conv.last_synced_at).getTime() : 0;
  if (Date.now() - lastSynced > SYNC_THROTTLE_MS) {
    await supabase
      .from("messenger_conversations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conv.id);

    const { data: credsRow } = await supabase
      .from("platform_credentials")
      .select("credentials")
      .eq("user_id", tenantId)
      .eq("platform", "messenger")
      .eq("is_active", true)
      .maybeSingle<{ credentials: MessengerCredentials }>();

    if (credsRow) {
      const remote = await new MessengerService(credsRow.credentials).fetchConversationMessages(conv.psid);
      let latest: { body: string; at: string } | null = null;
      for (const m of remote ?? []) {
        if (!m.message) continue; // text-only sync — attachments arrive via the webhook echo
        const { error } = await supabase.from("messenger_messages").insert({
          conversation_id: conv.id,
          user_id: tenantId,
          mid: m.id,
          direction: m.fromPage ? "outbound" : "inbound",
          message_type: "text",
          body: m.message,
          status: m.fromPage ? "sent" : "received",
          sent_at: m.createdTime,
        });
        if (error) {
          if (error.code !== "23505") {
            console.error("[messenger/conversations/messages] Sync insert failed", error);
          }
          continue;
        }
        if (!latest || m.createdTime > latest.at) latest = { body: m.message, at: m.createdTime };
      }
      if (latest) {
        await supabase
          .from("messenger_conversations")
          .update({ last_message_at: latest.at, last_message_preview: latest.body.slice(0, 200) })
          .eq("id", conv.id);
      }
    }
  }

  const { data: messages } = await supabase
    .from("messenger_messages")
    .select("id, direction, message_type, body, media_url, ai_generated, status, sent_at, created_at")
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
  const tenantId = getTenantId();
  const { data: conv } = await supabase
    .from("messenger_conversations")
    .select("id, psid, contact_name")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: credsRow } = await supabase
    .from("platform_credentials")
    .select("credentials")
    .eq("user_id", tenantId)
    .eq("platform", "messenger")
    .eq("is_active", true)
    .maybeSingle<{ credentials: MessengerCredentials }>();

  if (!credsRow) {
    return apiError("MESSENGER_NOT_CONNECTED", "Connect Facebook Messenger in Settings first.", 400);
  }

  const messenger = new MessengerService(credsRow.credentials);
  const caption = parsed.body?.trim() || null;
  try {
    let messageId: string;
    if (parsed.media_url) {
      const sent = await messenger.sendImageMessage(conv.psid, parsed.media_url);
      messageId = sent.messageId;
      // Messenger attachments have no caption field — send the text as a
      // separate follow-up message. Best-effort: the image still counts as sent.
      if (caption) {
        try {
          await messenger.sendTextMessage(conv.psid, caption);
        } catch (err) {
          console.error("[messenger/conversations/messages] Caption follow-up failed", err);
        }
      }
    } else {
      const sent = await messenger.sendTextMessage(conv.psid, caption!);
      messageId = sent.messageId;
    }

    const { data: message } = await supabase
      .from("messenger_messages")
      .insert({
        conversation_id: conv.id,
        user_id: tenantId,
        mid: messageId,
        direction: "outbound",
        message_type: parsed.media_url ? "image" : "text",
        body: caption,
        media_url: parsed.media_url ?? null,
        status: "sent",
        ai_generated: false,
        sent_at: new Date().toISOString(),
      })
      .select("id, direction, message_type, body, media_url, ai_generated, status, sent_at, created_at")
      .single();

    await supabase
      .from("messenger_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: caption || (parsed.media_url ? "📷 Image" : ""),
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
