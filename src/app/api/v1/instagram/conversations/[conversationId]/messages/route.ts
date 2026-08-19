import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { InstagramEngagementService } from "@/services/platforms/instagram/instagram-engagement.service";

const SendSchema = z.object({ body: z.string().min(1).max(2000) });

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
    .select("id, direction, message_type, body, ai_generated, status, sent_at, created_at")
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

  try {
    const sent = await ig.sendTextDm(conv.contact_ig_id, parsed.body);

    const { data: message } = await supabase
      .from("instagram_dm_messages")
      .insert({
        conversation_id: conv.id,
        user_id: tenantId,
        ig_message_id: sent.messageId || null,
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
      .from("instagram_dm_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: parsed.body.slice(0, 200),
      })
      .eq("id", conv.id);

    return apiSuccess({ message });
  } catch (err) {
    return apiError("SEND_FAILED", err instanceof Error ? err.message : "Send failed", 500);
  }
}
