import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { uploadMediaBuffer } from "@/services/media.service";
import { BaileysWhatsAppService, BaileysSendError } from "@/services/platforms/whatsapp-baileys/baileys-whatsapp.service";
import { getBaileysSocket } from "@/services/platforms/whatsapp-baileys/baileys-connection";

const SendSchema = z.object({ body: z.string().min(1).max(4096) });

interface GroupConvRow {
  id: string;
  group_jid: string;
}

/**
 * POST /api/v1/whatsapp/groups/conversations/:groupConversationId/messages
 *
 * Sends a manual reply into a group thread — a JSON { body } for text, or
 * multipart/form-data (file, caption?) for an image. Groups are read + reply
 * only, so this never touches the AI/lead pipeline.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupConversationId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { groupConversationId } = await context.params;

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data: conv } = await supabase
    .from("whatsapp_group_conversations")
    .select("id, group_jid")
    .eq("id", groupConversationId)
    .eq("user_id", tenantId)
    .maybeSingle<GroupConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Group conversation not found", 404);

  const { data: connectionStatus } = await supabase
    .from("whatsapp_connection_status")
    .select("status")
    .eq("user_id", tenantId)
    .maybeSingle<{ status: string }>();

  if (connectionStatus?.status !== "connected") {
    return apiError("WHATSAPP_NOT_CONNECTED", "Scan the WhatsApp QR code in Settings first.", 400);
  }

  const wa = new BaileysWhatsAppService(await getBaileysSocket());
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const caption = form.get("caption");
      if (!(file instanceof File)) return apiError("INVALID_REQUEST", "Missing 'file'", 400);
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        return apiError("INVALID_REQUEST", "Only JPEG/PNG images are supported for group sends.", 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadMediaBuffer(tenantId, "whatsapp-group-outbound", buffer, file.type);
      const captionText = typeof caption === "string" ? caption.trim() : "";
      const sent = await wa.sendGroupImageMessage(conv.group_jid, url, captionText || undefined);

      const { data: message } = await supabase
        .from("whatsapp_group_messages")
        .insert({
          group_conversation_id: conv.id,
          user_id: tenantId,
          wa_message_id: sent.messageId,
          direction: "outbound",
          message_type: "image",
          body: captionText || null,
          media_url: url,
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .select("id, direction, message_type, sender_name, body, media_url, status, sent_at, created_at")
        .single();

      await supabase
        .from("whatsapp_group_conversations")
        .update({ last_message_at: new Date().toISOString(), last_message_preview: captionText || "📷 Image" })
        .eq("id", conv.id);

      return apiSuccess({ message });
    }

    const parsed = SendSchema.parse(await request.json());
    const sent = await wa.sendGroupTextMessage(conv.group_jid, parsed.body);

    const { data: message } = await supabase
      .from("whatsapp_group_messages")
      .insert({
        group_conversation_id: conv.id,
        user_id: tenantId,
        wa_message_id: sent.messageId,
        direction: "outbound",
        message_type: "text",
        body: parsed.body,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id, direction, message_type, sender_name, body, media_url, status, sent_at, created_at")
      .single();

    await supabase
      .from("whatsapp_group_conversations")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: parsed.body.slice(0, 200) })
      .eq("id", conv.id);

    return apiSuccess({ message });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError("INVALID_REQUEST", err.issues.map((i) => i.message).join("; "), 400);
    }
    if (err instanceof BaileysSendError) {
      console.error("[whatsapp/groups/messages] Baileys rejected the send", {
        userId,
        groupConversationId,
        message: err.message,
      });
      return apiError("WHATSAPP_SEND_ERROR", err.message, 502);
    }
    console.error("[whatsapp/groups/messages] Unexpected failure", { userId, groupConversationId, err });
    return apiError("SEND_FAILED", err instanceof Error ? err.message : "Send failed", 500);
  }
}
