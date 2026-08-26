import { Boom } from "@hapi/boom";
import { delay, type WASocket } from "@whiskeysockets/baileys";
import { getBaileysSocket } from "./baileys-connection";

export class BaileysSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaileysSendError";
  }
}

export interface BaileysSendResult {
  messageId: string;
}

/** True for the transient "socket dropped between grabbing it and sending" error (Boom 428, "Connection Closed"). */
function isConnectionClosedError(err: unknown): boolean {
  if (err instanceof Boom) return err.output?.statusCode === 428;
  return err instanceof Error && err.message === "Connection Closed";
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

  /**
   * Runs a send against the socket we were constructed with; if it fails
   * because the connection had just dropped (a normal, occasional thing for
   * this kind of WebSocket client — the auto-reconnect in
   * baileys-connection.ts is very likely already mid-flight), wait briefly
   * for that reconnect and retry once against a fresh socket before giving up.
   */
  private async withRetry<T>(fn: (sock: WASocket) => Promise<T>): Promise<T> {
    try {
      return await fn(this.sock);
    } catch (err) {
      if (!isConnectionClosedError(err)) throw err;
      await delay(2500);
      const freshSock = await getBaileysSocket();
      return fn(freshSock);
    }
  }

  /** Sends a free-form text message. Baileys has no 24h-window restriction. */
  async sendTextMessage(toPhone: string, body: string): Promise<BaileysSendResult> {
    return this.withRetry(async (sock) => {
      const sent = await sock.sendMessage(this.jid(toPhone), { text: body });
      if (!sent?.key?.id) throw new BaileysSendError("Baileys text send returned no message key");
      return { messageId: sent.key.id };
    });
  }

  /** Sends an image by public URL — Baileys fetches it directly. */
  async sendImageMessage(toPhone: string, imageUrl: string, caption?: string): Promise<BaileysSendResult> {
    return this.withRetry(async (sock) => {
      const sent = await sock.sendMessage(this.jid(toPhone), {
        image: { url: imageUrl },
        ...(caption?.trim() && { caption: caption.trim() }),
      });
      if (!sent?.key?.id) throw new BaileysSendError("Baileys image send returned no message key");
      return { messageId: sent.key.id };
    });
  }

  /** Sends a voice/audio clip by public URL. Matches the mimetype our transcode pipeline uploads. */
  async sendAudioMessage(toPhone: string, audioUrl: string): Promise<BaileysSendResult> {
    return this.withRetry(async (sock) => {
      const sent = await sock.sendMessage(this.jid(toPhone), {
        audio: { url: audioUrl },
        mimetype: "audio/mpeg",
      });
      if (!sent?.key?.id) throw new BaileysSendError("Baileys audio send returned no message key");
      return { messageId: sent.key.id };
    });
  }

  /** Marks an incoming message as read so the customer sees blue checkmarks. */
  async markAsRead(fromPhone: string, waMessageId: string): Promise<void> {
    await this.sock.readMessages([{ remoteJid: this.jid(fromPhone), id: waMessageId, fromMe: false }]);
  }
}
