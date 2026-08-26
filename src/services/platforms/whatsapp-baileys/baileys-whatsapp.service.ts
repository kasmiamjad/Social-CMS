import type { WASocket } from "@whiskeysockets/baileys";

export class BaileysSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaileysSendError";
  }
}

export interface BaileysSendResult {
  messageId: string;
}

/**
 * Thin wrapper around the live Baileys socket, exposing the same method
 * names the rest of the app already calls (previously against Meta's Cloud
 * API via WhatsAppService) so every call site only swaps its constructor,
 * not its logic.
 */
export class BaileysWhatsAppService {
  constructor(private sock: WASocket) {}

  private jid(phone: string): string {
    return `${phone.replace(/[^\d]/g, "")}@s.whatsapp.net`;
  }

  /** Sends a free-form text message. Baileys has no 24h-window restriction. */
  async sendTextMessage(toPhone: string, body: string): Promise<BaileysSendResult> {
    const sent = await this.sock.sendMessage(this.jid(toPhone), { text: body });
    if (!sent?.key?.id) throw new BaileysSendError("Baileys text send returned no message key");
    return { messageId: sent.key.id };
  }

  /** Sends an image by public URL — Baileys fetches it directly. */
  async sendImageMessage(toPhone: string, imageUrl: string, caption?: string): Promise<BaileysSendResult> {
    const sent = await this.sock.sendMessage(this.jid(toPhone), {
      image: { url: imageUrl },
      ...(caption?.trim() && { caption: caption.trim() }),
    });
    if (!sent?.key?.id) throw new BaileysSendError("Baileys image send returned no message key");
    return { messageId: sent.key.id };
  }

  /** Sends a voice/audio clip by public URL. Matches the mimetype our transcode pipeline uploads. */
  async sendAudioMessage(toPhone: string, audioUrl: string): Promise<BaileysSendResult> {
    const sent = await this.sock.sendMessage(this.jid(toPhone), {
      audio: { url: audioUrl },
      mimetype: "audio/mpeg",
    });
    if (!sent?.key?.id) throw new BaileysSendError("Baileys audio send returned no message key");
    return { messageId: sent.key.id };
  }

  /** Marks an incoming message as read so the customer sees blue checkmarks. */
  async markAsRead(fromPhone: string, waMessageId: string): Promise<void> {
    await this.sock.readMessages([{ remoteJid: this.jid(fromPhone), id: waMessageId, fromMe: false }]);
  }
}
