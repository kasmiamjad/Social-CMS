import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { BaileysWhatsAppService, BaileysSendError } from "@/services/platforms/whatsapp-baileys/baileys-whatsapp.service";
import { getBaileysSocket } from "@/services/platforms/whatsapp-baileys/baileys-connection";

const SendSchema = z.object({ body: z.string().min(1).max(4096) });

interface ConvRow {
  id: string;
  contact_phone: string;
  contact_name: string | null;
}

/**
 * GET /api/v1/whatsapp/conversations/:conversationId/messages
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
    .from("whatsapp_conversations")
    .select("id, contact_phone, contact_name")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("id, direction, message_type, body, media_url, ai_generated, status, sent_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return apiSuccess({
    channel: "whatsapp",
    contact_name: conv.contact_name,
    contact: conv.contact_phone,
    messages: messages ?? [],
  });
}

/**
 * POST /api/v1/whatsapp/conversations/:conversationId/messages
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
    .from("whatsapp_conversations")
    .select("id, contact_phone, contact_name")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: connectionStatus } = await supabase
    .from("whatsapp_connection_status")
    .select("status")
    .eq("user_id", tenantId)
    .maybeSingle<{ status: string }>();

  if (connectionStatus?.status !== "connected") {
    return apiError("WHATSAPP_NOT_CONNECTED", "Scan the WhatsApp QR code in Settings first.", 400);
  }

  const wa = new BaileysWhatsAppService(await getBaileysSocket());
  try {
    const sent = await wa.sendTextMessage(conv.contact_phone, parsed.body);

    const { data: message } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conv.id,
        user_id: tenantId,
        wa_message_id: sent.messageId,
        direction: "outbound",
        message_type: "text",
        body: parsed.body,
        status: "sent",
        ai_generated: false,
        sent_at: new Date().toISOString(),
      })
      .select("id, direction, message_type, body, media_url, ai_generated, status, sent_at, created_at")
      .single();

    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: parsed.body.slice(0, 200),
      })
      .eq("id", conv.id);

    return apiSuccess({ message });
  } catch (err) {
    if (err instanceof BaileysSendError) {
      console.error("[whatsapp/conversations/messages] Baileys rejected the send", {
        userId,
        conversationId,
        to: conv.contact_phone,
        message: err.message,
      });
      return apiError("WHATSAPP_SEND_ERROR", err.message, 502);
    }
    console.error("[whatsapp/conversations/messages] Unexpected failure", {
      userId,
      conversationId,
      err,
    });
    return apiError("SEND_FAILED", err instanceof Error ? err.message : "Send failed", 500);
  }
}
