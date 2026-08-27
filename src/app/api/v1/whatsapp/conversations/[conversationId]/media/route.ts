import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { uploadMediaBuffer } from "@/services/media.service";
import { transcodeToMp3, TranscodeError } from "@/lib/audio-transcode";
import { BaileysWhatsAppService, BaileysSendError } from "@/services/platforms/whatsapp-baileys/baileys-whatsapp.service";
import { getBaileysSocket } from "@/services/platforms/whatsapp-baileys/baileys-connection";

interface ConvRow {
  id: string;
  contact_phone: string;
}

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const MAX_BYTES = 16 * 1024 * 1024;

/**
 * POST /api/v1/whatsapp/conversations/:conversationId/media
 *
 * Sends an image or voice clip to the conversation's contact from the Leads
 * chat drawer. multipart/form-data body: file, caption? (images only).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { conversationId } = await context.params;

  const form = await request.formData();
  const file = form.get("file");
  const caption = form.get("caption");

  if (!(file instanceof File)) {
    return apiError("INVALID_REQUEST", "Missing 'file'", 400);
  }
  if (file.size > MAX_BYTES) {
    return apiError("INVALID_REQUEST", `File too large: max ${MAX_BYTES / 1024 / 1024}MB`, 400);
  }

  const isImage = IMAGE_TYPES.includes(file.type);
  // See send-media/route.ts for why audio isn't matched against a fixed list.
  const isAudio = file.type.startsWith("audio/");
  if (!isImage && !isAudio) {
    return apiError(
      "INVALID_REQUEST",
      `Unsupported file type: ${file.type || "(unknown)"}. Allowed: JPEG/PNG images or any audio file.`,
      400
    );
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("id, contact_phone")
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
  const captionText = typeof caption === "string" ? caption.trim() : "";

  try {
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    if (isAudio) {
      buffer = await transcodeToMp3(buffer);
      contentType = "audio/mpeg";
    }
    const { url } = await uploadMediaBuffer(tenantId, "whatsapp-outbound", buffer, contentType);

    const sent = isImage
      ? await wa.sendImageMessage(conv.contact_phone, url, captionText || undefined)
      : await wa.sendAudioMessage(conv.contact_phone, url);

    const { data: message } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conv.id,
        user_id: tenantId,
        wa_message_id: sent.messageId,
        direction: "outbound",
        // Our own CRM shows outbound recordings with the custom voice-note
        // player regardless of what the recipient's WhatsApp renders it as.
        message_type: isImage ? "image" : "audio",
        body: isImage ? captionText || null : null,
        media_url: url,
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
        last_message_preview: isImage ? captionText || "📷 Image" : "🎙️ Audio",
      })
      .eq("id", conv.id);

    return apiSuccess({ message });
  } catch (err) {
    if (err instanceof TranscodeError) {
      console.error("[whatsapp/conversations/media] Audio transcode failed", {
        userId,
        conversationId,
        err,
      });
      return apiError("AUDIO_TRANSCODE_FAILED", err.message, 500);
    }
    if (err instanceof BaileysSendError) {
      console.error("[whatsapp/conversations/media] Baileys rejected the send", {
        userId,
        conversationId,
        to: conv.contact_phone,
        message: err.message,
      });
      return apiError("WHATSAPP_SEND_ERROR", err.message, 502);
    }
    console.error("[whatsapp/conversations/media] Unexpected failure", {
      userId,
      conversationId,
      err,
    });
    return apiError("SEND_FAILED", err instanceof Error ? err.message : "Send failed", 500);
  }
}
