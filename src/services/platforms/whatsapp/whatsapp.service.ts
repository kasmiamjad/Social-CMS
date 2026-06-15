import crypto from "crypto";
import { WHATSAPP_GRAPH_BASE_URL } from "./whatsapp.constants";
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

  // ── Internal Graph API helper ────────────────────────────────────────────

  private async graphPost<T>(path: string, payload: unknown): Promise<T> {
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
      throw new WhatsAppApiError(
        errPayload.error?.message ?? "WhatsApp API error",
        res.status,
        data
      );
    }
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
