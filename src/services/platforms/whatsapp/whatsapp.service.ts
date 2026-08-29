import crypto from "crypto";
import { WHATSAPP_GRAPH_BASE_URL } from "./whatsapp.constants";
import { logWhatsAppDebugEvent } from "@/lib/whatsapp-debug-log";
import type {
  WhatsAppApiErrorResponse,
  WhatsAppCredentials,
  WhatsAppSendApiResponse,
  WhatsAppSendTextResult,
} from "./whatsapp.types";

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiError?: unknown
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

/**
 * WhatsApp Cloud API client.
 * Wraps the Meta Graph API for sending messages and verifying webhooks.
 */
export class WhatsAppService {
  constructor(private credentials: WhatsAppCredentials) {}

  /**
   * Sends a free-form text message to a customer.
   * NOTE: Only allowed inside the 24-hour customer service window.
   * Outside that window, use sendTemplate() instead.
   */
  async sendTextMessage(toPhone: string, body: string): Promise<WhatsAppSendTextResult> {
    const normalizedPhone = normalizePhoneNumber(toPhone);
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "text",
      text: { preview_url: false, body },
    };

    const res = await this.graphPost<WhatsAppSendApiResponse>(
      `/${this.credentials.phone_number_id}/messages`,
      payload
    );

    const messageId = res.messages?.[0]?.id;
    if (!messageId) {
      throw new WhatsAppApiError("WhatsApp send returned no message ID", 500, res);
    }
    return { messageId };
  }

  /**
   * Sends an image to a customer by public URL.
   * The URL must be publicly accessible over HTTPS — Meta fetches it directly.
   */
  async sendImageMessage(
    toPhone: string,
    imageUrl: string,
    caption?: string
  ): Promise<WhatsAppSendTextResult> {
    const normalizedPhone = normalizePhoneNumber(toPhone);
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "image",
      image: {
        link: imageUrl,
        ...(caption?.trim() && { caption: caption.trim() }),
      },
    };

    const res = await this.graphPost<WhatsAppSendApiResponse>(
      `/${this.credentials.phone_number_id}/messages`,
      payload
    );

    const messageId = res.messages?.[0]?.id;
    if (!messageId) {
      throw new WhatsAppApiError("WhatsApp image send returned no message ID", 500, res);
    }
    return { messageId };
  }

  /**
   * Sends a document (PDF, etc.) to a customer by public URL.
   * The URL must be publicly accessible over HTTPS — Meta fetches it directly.
   */
  async sendDocumentMessage(
    toPhone: string,
    documentUrl: string,
    filename?: string,
    caption?: string
  ): Promise<WhatsAppSendTextResult> {
    const normalizedPhone = normalizePhoneNumber(toPhone);
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "document",
      document: {
        link: documentUrl,
        ...(filename?.trim() && { filename: filename.trim() }),
        ...(caption?.trim() && { caption: caption.trim() }),
      },
    };

    const res = await this.graphPost<WhatsAppSendApiResponse>(
      `/${this.credentials.phone_number_id}/messages`,
      payload
    );

    const messageId = res.messages?.[0]?.id;
    if (!messageId) {
      throw new WhatsAppApiError("WhatsApp document send returned no message ID", 500, res);
    }
    return { messageId };
  }

  /**
   * Sends a voice note by uploading the audio directly to Meta first (the
   * documented, recommended path — sending by "link" is explicitly called
   * out as "not recommended" and was the likely cause of persistent
   * "Media upload error" failures when hosted-URL delivery was used
   * instead). `voice: true` is the explicit flag for the mic-icon/waveform
   * voice-note rendering — audio.ogg + OPUS codec is still required for it
   * to actually display that way; other formats deliver as a plain
   * audio-file attachment regardless of this flag.
   */
  async sendAudioMessage(
    toPhone: string,
    buffer: Buffer,
    contentType: string,
    isVoiceNote: boolean = true
  ): Promise<WhatsAppSendTextResult> {
    const { mediaId } = await this.uploadMedia(buffer, contentType);
    const normalizedPhone = normalizePhoneNumber(toPhone);
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "audio",
      audio: { id: mediaId, voice: isVoiceNote },
    };

    const res = await this.graphPost<WhatsAppSendApiResponse>(
      `/${this.credentials.phone_number_id}/messages`,
      payload
    );

    const messageId = res.messages?.[0]?.id;
    if (!messageId) {
      throw new WhatsAppApiError("WhatsApp audio send returned no message ID", 500, res);
    }
    return { messageId };
  }

  /**
   * Uploads a media buffer directly to Meta (the recommended path over
   * sending by hosted "link" — see sendAudioMessage). Returns a media id
   * valid for 30 days, referenced in a subsequent send via {id: mediaId}.
   */
  async uploadMedia(buffer: Buffer, contentType: string): Promise<{ mediaId: string }> {
    void logWhatsAppDebugEvent("info", "media_upload_attempt", `Uploading ${contentType} (${buffer.length} bytes) to Meta…`);

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([Uint8Array.from(buffer)], { type: contentType }), `upload.${extFromContentType(contentType)}`);

    const url = `${WHATSAPP_GRAPH_BASE_URL}/${this.credentials.phone_number_id}/media`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.credentials.access_token}` },
      body: form,
    });

    const data = await res.json();
    if (!res.ok || !data.id) {
      const errPayload = data as WhatsAppApiErrorResponse;
      const errMessage = errPayload.error?.message ?? "WhatsApp media upload failed";
      void logWhatsAppDebugEvent("error", "media_upload_failed", `Media upload failed: ${errMessage}`, {
        statusCode: res.status,
        apiError: errPayload.error,
      });
      throw new WhatsAppApiError(errMessage, res.status, data);
    }
    void logWhatsAppDebugEvent("info", "media_upload_success", `Media uploaded to Meta (id ${data.id}).`);
    return { mediaId: data.id as string };
  }

  /**
   * Sends a pre-approved template message.
   * Required for outbound messages outside the 24-hour window.
   */
  async sendTemplateMessage(
    toPhone: string,
    templateName: string,
    languageCode: string = "en_US",
    components: unknown[] = []
  ): Promise<WhatsAppSendTextResult> {
    const normalizedPhone = normalizePhoneNumber(toPhone);
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 && { components }),
      },
    };

    const res = await this.graphPost<WhatsAppSendApiResponse>(
      `/${this.credentials.phone_number_id}/messages`,
      payload
    );

    const messageId = res.messages?.[0]?.id;
    if (!messageId) {
      throw new WhatsAppApiError("WhatsApp template send returned no message ID", 500, res);
    }
    return { messageId };
  }

  /**
   * Marks an incoming message as "read" so the customer sees blue checkmarks.
   * Best practice — call this on every incoming message.
   */
  async markAsRead(waMessageId: string): Promise<void> {
    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: waMessageId,
    };

    await this.graphPost<unknown>(
      `/${this.credentials.phone_number_id}/messages`,
      payload
    );
  }

  /**
   * Verifies the webhook subscription handshake from Meta.
   * Meta sends GET ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y.
   * We must echo the challenge IFF the verify_token matches our configured one.
   */
  verifyWebhookSubscription(mode: string | null, token: string | null, challenge: string | null): string | null {
    if (mode === "subscribe" && token === this.credentials.verify_token && challenge) {
      return challenge;
    }
    return null;
  }

  /**
   * Verifies the HMAC signature Meta includes on every webhook POST.
   * Header: X-Hub-Signature-256: sha256=<hex_digest>
   *
   * IMPORTANT: rawBody must be the EXACT raw bytes Meta sent — JSON.stringify
   * of the parsed body will not match because of whitespace differences.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return false;
    }
    const expectedSig = signatureHeader.slice("sha256=".length).trim();
    const computedSig = crypto
      .createHmac("sha256", this.credentials.app_secret)
      .update(rawBody)
      .digest("hex");

    // Constant-time comparison to avoid timing attacks.
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig, "hex"),
        Buffer.from(computedSig, "hex")
      );
    } catch {
      return false;
    }
  }

  /**
   * Fetches a media URL for a given media ID returned in a webhook payload.
   * Media URLs expire quickly — download immediately if you need to keep the file.
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    const url = `${WHATSAPP_GRAPH_BASE_URL}/${mediaId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.credentials.access_token}` },
    });
    const data = (await res.json()) as { url?: string } & Partial<WhatsAppApiErrorResponse>;
    if (!res.ok || !data.url) {
      throw new WhatsAppApiError(
        data.error?.message ?? "Failed to fetch media URL",
        res.status,
        data
      );
    }
    return data.url;
  }

  /**
   * Downloads the raw bytes of an inbound media message (image, sticker,
   * video, audio, document). Meta's media URLs expire within minutes and
   * require the same Bearer token as the Graph API itself, so this must be
   * called promptly after receiving the webhook and the bytes re-hosted
   * (e.g. to Supabase Storage) if you want to keep them.
   */
  async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; contentType: string }> {
    const mediaUrl = await this.getMediaUrl(mediaId);
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${this.credentials.access_token}` },
    });
    if (!res.ok) {
      throw new WhatsAppApiError(`Failed to download media (HTTP ${res.status})`, res.status);
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
  }

  // ── Internal Graph API helper ────────────────────────────────────────────

  private async graphPost<T>(path: string, payload: unknown): Promise<T> {
    const { to, type } = describeOutboundPayload(payload);
    const label = `${type}${to ? ` to ${to}` : ""}`;
    void logWhatsAppDebugEvent("info", "send_attempt", `Sending ${label}…`);

    const url = `${WHATSAPP_GRAPH_BASE_URL}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.credentials.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const errPayload = data as WhatsAppApiErrorResponse;
      const errMessage = errPayload.error?.message ?? "WhatsApp API error";
      void logWhatsAppDebugEvent(
        "error",
        "send_failed",
        `Failed to send ${label}: ${errMessage} (HTTP ${res.status})`,
        { statusCode: res.status, apiError: errPayload.error }
      );
      throw new WhatsAppApiError(errMessage, res.status, data);
    }
    void logWhatsAppDebugEvent("info", "send_success", `Sent ${label}.`);
    return data as T;
  }
}

/**
 * Strips the leading + from a phone number for Cloud API "to" field.
 * Cloud API accepts both formats but the canonical form is digits-only.
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "audio/mp4": "m4a",
};

/** Filename extension for the multipart upload — Meta infers actual type from the `type` field, this is just cosmetic. */
function extFromContentType(contentType: string): string {
  return EXT_BY_CONTENT_TYPE[contentType.split(";")[0].trim()] ?? "bin";
}

/** Pulls a readable recipient/type out of a Graph API payload for debug-log labels. */
function describeOutboundPayload(payload: unknown): { to: string | null; type: string } {
  if (payload && typeof payload === "object") {
    const p = payload as { to?: string; type?: string; status?: string };
    if (p.status === "read") return { to: null, type: "read receipt" };
    return { to: p.to ?? null, type: p.type ?? "message" };
  }
  return { to: null, type: "message" };
}
