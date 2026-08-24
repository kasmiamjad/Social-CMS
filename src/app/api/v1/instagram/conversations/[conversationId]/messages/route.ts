import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { InstagramEngagementService } from "@/services/platforms/instagram/instagram-engagement.service";

const SendSchema = z
  .object({
    body: z.string().max(2000).optional(),
    media_url: z.string().url().optional(),
  })
  .refine((d) => (d.body && d.body.trim()) || d.media_url, "body or media_url is required");

interface ConvRow {
  id: string;
  contact_ig_id: string;
  contact_username: string | null;
  contact_name: string | null;
}

interface IgCredentials {
  account_id?: string;
  access_token?: string;
  app_secret?: string;
  verify_token?: string;
}

/**
 * GET /api/v1/instagram/conversations/:conversationId/messages
 * Returns the Instagram DM conversation header + messages (oldest → newest),
 * so the shared chat drawer can render it like WhatsApp/Messenger.
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
    .from("instagram_dm_conversations")
    .select("id, contact_ig_id, contact_username, contact_name")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: messages } = await supabase
    .from("instagram_dm_messages")
    .select("id, direction, message_type, body, media_url, ai_generated, status, sent_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return apiSuccess({
    channel: "instagram",
    contact_name: conv.contact_name ?? conv.contact_username,
    contact: conv.contact_username ?? conv.contact_ig_id,
    messages: messages ?? [],
  });
}

/**
 * POST /api/v1/instagram/conversations/:conversationId/messages
 * Sends a manual DM reply to the customer and persists it. Subject to
 * Instagram's 24-hour messaging window.
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
    .from("instagram_dm_conversations")
    .select("id, contact_ig_id, contact_username, contact_name")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: credsRow } = await supabase
    .from("platform_credentials")
    .select("credentials")
    .eq("user_id", tenantId)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .maybeSingle<{ credentials: IgCredentials }>();

  if (!credsRow?.credentials?.account_id || !credsRow.credentials.access_token) {
    return apiError("INSTAGRAM_NOT_CONNECTED", "Connect Instagram in Settings first.", 400);
  }

  const ig = new InstagramEngagementService({
    account_id: credsRow.credentials.account_id,
    access_token: credsRow.credentials.access_token,
    app_secret: credsRow.credentials.app_secret,
    verify_token: credsRow.credentials.verify_token,
  });

  const caption = parsed.body?.trim() || null;
  try {
    let messageId: string;
    if (parsed.media_url) {
      const sent = await ig.sendImageDm(conv.contact_ig_id, parsed.media_url);
      messageId = sent.messageId;
      // Instagram DM attachments have no caption field — send the text as a
      // separate follow-up message. Best-effort: the image still counts as sent.
      if (caption) {
        try {
          await ig.sendTextDm(conv.contact_ig_id, caption);
        } catch (err) {
          console.error("[instagram/conversations/messages] Caption follow-up failed", err);
        }
      }
    } else {
      const sent = await ig.sendTextDm(conv.contact_ig_id, caption!);
      messageId = sent.messageId;
    }

    const { data: message } = await supabase
      .from("instagram_dm_messages")
      .insert({
        conversation_id: conv.id,
        user_id: tenantId,
        ig_message_id: messageId || null,
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
      .from("instagram_dm_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: caption || (parsed.media_url ? "📷 Image" : ""),
      })
      .eq("id", conv.id);

    return apiSuccess({ message });
  } catch (err) {
    return apiError("SEND_FAILED", err instanceof Error ? err.message : "Send failed", 500);
  }
}
