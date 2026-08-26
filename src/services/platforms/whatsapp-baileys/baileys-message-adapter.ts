import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { getContentType, downloadMediaMessage, toNumber } from "@whiskeysockets/baileys";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadMediaBuffer } from "@/services/media.service";
import { WhatsAppAutoReplyService, extractMessagePreview } from "@/services/whatsapp/auto-reply.service";
import { baileysLogger } from "./baileys-logger";
import type {
  WhatsAppContact,
  WhatsAppIncomingMessage,
  WhatsAppInboundMedia,
} from "@/services/platforms/whatsapp/whatsapp.types";

/**
 * Resolves a phone number for a chat. WhatsApp's newer @lid addressing
 * anonymizes the JID in some 1:1 chats — when that happens, Baileys carries
 * the actual phone-number JID (if it has seen the mapping) in `remoteJidAlt`.
 */
function resolvePhoneNumber(remoteJid: string, remoteJidAlt?: string | null): string | null {
  const pnJid = remoteJid.endsWith("@lid") ? remoteJidAlt : remoteJid;
  if (!pnJid || !pnJid.endsWith("@s.whatsapp.net")) return null;
  return pnJid.split("@")[0];
}

/**
 * Translates one inbound Baileys WAMessage into the normalized shape the
 * existing auto-reply pipeline expects, downloading media synchronously —
 * unlike Meta's Graph API, Baileys has no "fetch by id later" step, the
 * bytes only exist on the event itself. Then hands off to the same
 * WhatsAppAutoReplyService the old Meta webhook called — all AI/lead/
 * booking logic there is unchanged.
 *
 * Messages sent directly from the linked phone's own WhatsApp app (fromMe)
 * are persisted so they show in the CRM thread, but skip the AI pipeline —
 * they're already an outbound reply, not a customer message to react to.
 */
export async function handleIncomingBaileysMessage(
  sock: WASocket,
  tenantId: string,
  waMessage: WAMessage
): Promise<void> {
  const remoteJid = waMessage.key.remoteJid;
  if (
    !remoteJid ||
    remoteJid.endsWith("@g.us") ||
    remoteJid.endsWith("@broadcast") ||
    remoteJid === "status@broadcast"
  ) {
    return; // groups/status/broadcasts are out of scope — 1:1 customer chats only
  }
  if (!waMessage.message) return; // protocol/reaction-only events carry no content

  const contentType = getContentType(waMessage.message);
  if (!contentType) return;

  const phone = resolvePhoneNumber(remoteJid, waMessage.key.remoteJidAlt);
  if (!phone) {
    // WhatsApp's newer privacy-preserving @lid addressing has no reverse
    // mapping back to a phone number unless Baileys has already cached it
    // (see key.remoteJidAlt) — without one there's no phone number to store
    // this message against, so skip rather than corrupt a lead's contact info.
    console.warn("[baileys] Skipping inbound message — no phone number could be resolved", { remoteJid });
    return;
  }
  const messageId = waMessage.key.id;
  if (!messageId) return;
  const timestamp = String(toNumber(waMessage.messageTimestamp ?? Math.floor(Date.now() / 1000)));

  const { message, media } = await buildIncomingMessage(sock, phone, messageId, timestamp, contentType, waMessage);
  if (!message) return;

  if (waMessage.key.fromMe) {
    await persistPhoneSentMessage(tenantId, phone, timestamp, message, media);
    return;
  }

  const contact: WhatsAppContact = { name: waMessage.pushName ?? null };
  // Constructed here rather than at module scope — this module sits in an
  // import cycle with auto-reply.service.ts via baileys-connection.ts, and a
  // top-level `new WhatsAppAutoReplyService()` would run before that circular
  // import finished resolving.
  await new WhatsAppAutoReplyService().processIncomingMessage(tenantId, contact, message, media);
}

async function buildIncomingMessage(
  sock: WASocket,
  phone: string,
  messageId: string,
  timestamp: string,
  contentType: string,
  waMessage: WAMessage
): Promise<{ message: WhatsAppIncomingMessage | null; media: WhatsAppInboundMedia | null }> {
  const content = waMessage.message!;
  const base = { from: phone, id: messageId, timestamp };

  switch (contentType) {
    case "conversation":
      return { message: { ...base, type: "text", text: { body: content.conversation ?? "" } }, media: null };
    case "extendedTextMessage":
      return {
        message: { ...base, type: "text", text: { body: content.extendedTextMessage?.text ?? "" } },
        media: null,
      };
    case "imageMessage": {
      const media = await downloadMedia(sock, waMessage, content.imageMessage?.mimetype ?? "image/jpeg");
      return {
        message: { ...base, type: "image", image: { caption: content.imageMessage?.caption ?? undefined } },
        media,
      };
    }
    case "videoMessage": {
      const media = await downloadMedia(sock, waMessage, content.videoMessage?.mimetype ?? "video/mp4");
      return {
        message: { ...base, type: "video", video: { caption: content.videoMessage?.caption ?? undefined } },
        media,
      };
    }
    case "audioMessage": {
      const media = await downloadMedia(sock, waMessage, content.audioMessage?.mimetype ?? "audio/ogg");
      return {
        message: { ...base, type: "audio", audio: { voice: content.audioMessage?.ptt ?? false } },
        media,
      };
    }
    case "documentMessage": {
      const media = await downloadMedia(
        sock,
        waMessage,
        content.documentMessage?.mimetype ?? "application/octet-stream"
      );
      return {
        message: { ...base, type: "document", document: { filename: content.documentMessage?.fileName ?? undefined } },
        media,
      };
    }
    case "stickerMessage": {
      const media = await downloadMedia(sock, waMessage, content.stickerMessage?.mimetype ?? "image/webp");
      return { message: { ...base, type: "sticker" }, media };
    }
    case "locationMessage": {
      const loc = content.locationMessage;
      if (!loc || loc.degreesLatitude == null || loc.degreesLongitude == null) {
        return { message: null, media: null };
      }
      return {
        message: {
          ...base,
          type: "location",
          location: {
            latitude: loc.degreesLatitude,
            longitude: loc.degreesLongitude,
            name: loc.name ?? undefined,
            address: loc.address ?? undefined,
          },
        },
        media: null,
      };
    }
    default:
      return { message: null, media: null }; // reactions, polls, protocol messages, etc. — not customer content
  }
}

async function downloadMedia(
  sock: WASocket,
  waMessage: WAMessage,
  contentType: string
): Promise<WhatsAppInboundMedia | null> {
  try {
    const buffer = await downloadMediaMessage(
      waMessage,
      "buffer",
      {},
      { logger: baileysLogger, reuploadRequest: sock.updateMediaMessage }
    );
    return { buffer, contentType };
  } catch (err) {
    console.error("[baileys] Failed to download inbound media", { err });
    return null;
  }
}

/**
 * Persists a message sent directly from the linked phone's own WhatsApp app
 * (not via this CRM) so the thread stays complete. No AI/lead logic — the
 * customer didn't send this, there's nothing to react to.
 */
async function persistPhoneSentMessage(
  tenantId: string,
  phone: string,
  timestamp: string,
  message: WhatsAppIncomingMessage,
  media: WhatsAppInboundMedia | null
): Promise<void> {
  const supabase = createAdminClient();
  const contactPhone = `+${phone}`;
  const sentAt = new Date(Number(timestamp) * 1000).toISOString();

  const mediaUrl = media
    ? (await uploadMediaBuffer(tenantId, "whatsapp-outbound", media.buffer, media.contentType)).url
    : null;
  const messageType = message.type === "audio" && message.audio?.voice === false ? "audio_file" : message.type;
  const body = message.type === "text" ? message.text?.body ?? null : extractMessagePreview(message);

  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .upsert(
      {
        user_id: tenantId,
        contact_phone: contactPhone,
        last_message_at: sentAt,
        last_message_preview: (body ?? "").slice(0, 200),
      },
      { onConflict: "user_id,contact_phone" }
    )
    .select("id")
    .single<{ id: string }>();
  if (!conversation) return;

  const { error } = await supabase.from("whatsapp_messages").insert({
    conversation_id: conversation.id,
    user_id: tenantId,
    wa_message_id: message.id,
    direction: "outbound",
    message_type: messageType,
    body,
    media_url: mediaUrl,
    status: "sent",
    ai_generated: false,
    sent_at: sentAt,
  });
  if (error && error.code !== "23505") {
    console.error("[baileys] Failed to persist phone-sent message", { error });
  }
}
