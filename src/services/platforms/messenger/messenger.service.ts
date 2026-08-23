import crypto from "crypto";
import { MESSENGER_GRAPH_BASE_URL } from "./messenger.constants";
import type {
  MessengerApiErrorResponse,
  MessengerCredentials,
  MessengerSendApiResponse,
  MessengerSendResult,
} from "./messenger.types";

export class MessengerApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiError?: unknown
  ) {
    super(message);
    this.name = "MessengerApiError";
  }
}

/**
 * Facebook Messenger Platform client.
 * Wraps the Meta Graph Send API and webhook verification.
 */
export class MessengerService {
  constructor(private credentials: MessengerCredentials) {}

  /**
   * Sends a text message to a customer by PSID.
   * NOTE: Only allowed inside the 24-hour standard messaging window unless a
   * message tag is used.
   */
  async sendTextMessage(psid: string, body: string): Promise<MessengerSendResult> {
    const payload = {
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text: body },
    };

    const res = await this.graphPost<MessengerSendApiResponse>(
      `/${this.credentials.page_id}/messages`,
      payload
    );

    if (!res.message_id) {
      throw new MessengerApiError("Messenger send returned no message id", 500, res);
    }
    return { messageId: res.message_id };
  }

  /**
   * Fetches a customer's public profile (display name) by PSID. Best-effort —
   * returns null if the permission isn't granted or the call fails.
   */
  async getUserProfile(psid: string): Promise<{ name: string | null } | null> {
    try {
      // The Messenger user-profile node exposes first_name/last_name — NOT a
      // combined `name` field (requesting `name` errors and returns nothing).
      const url = `${MESSENGER_GRAPH_BASE_URL}/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(
        this.credentials.page_access_token
      )}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Messenger getUserProfile failed", {
          psid,
          status: res.status,
          body: await res.text().catch(() => ""),
        });
        return null;
      }
      const data = (await res.json()) as { first_name?: string; last_name?: string };
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
      return { name: name || null };
    } catch {
      return null;
    }
  }

  /**
   * Fallback name lookup via the Page Inbox "Conversations" API. Meta blocks
   * the direct /{psid} Person-profile lookup (getUserProfile) for most
   * third-party apps without Advanced Access, but the Conversations edge
   * (used by Meta's own Business Inbox) sometimes still exposes participant
   * names under the app's existing pages_messaging access. Best-effort —
   * returns null if unavailable.
   */
  async getConversationParticipantName(psid: string): Promise<{ name: string | null } | null> {
    try {
      const url = `${MESSENGER_GRAPH_BASE_URL}/${this.credentials.page_id}/conversations?fields=participants&user_id=${encodeURIComponent(
        psid
      )}&access_token=${encodeURIComponent(this.credentials.page_access_token)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Messenger getConversationParticipantName failed", {
          psid,
          status: res.status,
          body: await res.text().catch(() => ""),
        });
        return null;
      }
      const data = (await res.json()) as {
        data?: { participants?: { data?: { name?: string; id?: string }[] } }[];
      };
      const participants = data.data?.[0]?.participants?.data ?? [];
      const customer = participants.find((p) => p.id !== this.credentials.page_id && p.name);
      return { name: customer?.name?.trim() || null };
    } catch {
      return null;
    }
  }

  /**
   * Verifies the webhook subscription handshake from Meta.
   * Meta sends GET ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y.
   */
  verifyWebhookSubscription(
    mode: string | null,
    token: string | null,
    challenge: string | null
  ): string | null {
    if (mode === "subscribe" && token === this.credentials.verify_token && challenge) {
      return challenge;
    }
    return null;
  }

  /**
   * Verifies the HMAC signature Meta includes on every webhook POST.
   * Header: X-Hub-Signature-256: sha256=<hex_digest> over the EXACT raw body.
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

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig, "hex"),
        Buffer.from(computedSig, "hex")
      );
    } catch {
      return false;
    }
  }

  // ── Internal Graph API helper ────────────────────────────────────────────

  private async graphPost<T>(path: string, payload: unknown): Promise<T> {
    const url = `${MESSENGER_GRAPH_BASE_URL}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.credentials.page_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const errPayload = data as MessengerApiErrorResponse;
      throw new MessengerApiError(
        errPayload.error?.message ?? "Messenger API error",
        res.status,
        data
      );
    }
    return data as T;
  }
}
