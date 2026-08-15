import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { uploadMediaBuffer } from "@/services/media.service";
import { WhatsAppService, WhatsAppApiError } from "@/services/platforms/whatsapp/whatsapp.service";
import type { WhatsAppCredentials } from "@/services/platforms/whatsapp/whatsapp.types";

interface ConvRow {
  id: string;
  contact_phone: string;
}

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const AUDIO_TYPES = ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"];
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
  const isAudio = AUDIO_TYPES.includes(file.type);
  if (!isImage && !isAudio) {
    return apiError(
      "INVALID_REQUEST",
      `Unsupported file type: ${file.type || "(unknown)"}. Allowed: ${[...IMAGE_TYPES, ...AUDIO_TYPES].join(", ")}`,
      400
    );
  }

  const supabase = createAdminClient();
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("id, contact_phone")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<ConvRow>();

  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  const { data: credsRow } = await supabase
    .from("platform_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "whatsapp")
    .eq("is_active", true)
    .maybeSingle<{ credentials: WhatsAppCredentials }>();

  if (!credsRow) {
    return apiError("WHATSAPP_NOT_CONNECTED", "Connect WhatsApp in Settings first.", 400);
  }

  const wa = new WhatsAppService(credsRow.credentials);
  const captionText = typeof caption === "string" ? caption.trim() : "";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadMediaBuffer(userId, "whatsapp-outbound", buffer, file.type);

    const sent = isImage
      ? await wa.sendImageMessage(conv.contact_phone, url, captionText || undefined)
      : await wa.sendAudioMessage(conv.contact_phone, url);

    const { data: message } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conv.id,
        user_id: userId,
        wa_message_id: sent.messageId,
        direction: "outbound",
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
    if (err instanceof WhatsAppApiError) {
      console.error("[whatsapp/conversations/media] Meta API rejected the send", {
        userId,
        conversationId,
        to: conv.contact_phone,
        statusCode: err.statusCode,
        message: err.message,
        apiError: err.apiError,
      });
      return apiError("WHATSAPP_API_ERROR", err.message, err.statusCode, err.apiError);
    }
    console.error("[whatsapp/conversations/media] Unexpected failure", {
      userId,
      conversationId,
      err,
    });
    return apiError("SEND_FAILED", err instanceof Error ? err.message : "Send failed", 500);
  }
}
