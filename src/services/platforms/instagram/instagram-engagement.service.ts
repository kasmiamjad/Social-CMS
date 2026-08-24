import crypto from "crypto";
import { IG_GRAPH_BASE_URL } from "./instagram.constants";
import type {
  InstagramReplyCommentResult,
  InstagramSendApiResponse,
  InstagramSendDmResult,
} from "./instagram-engagement.types";

export class InstagramEngagementApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiError?: unknown
  ) {
    super(message);
    this.name = "InstagramEngagementApiError";
  }
}

interface InstagramEngagementCredentials {
  /** Instagram Business Account ID (numeric, 15+ digits). */
  account_id: string;
  /** Long-lived access token with messaging + comment scopes. */
  access_token: string;
  /** Meta App Secret — used to verify webhook HMAC signatures. */
  app_secret?: string;
  /** Webhook verify token chosen by the user. */
  verify_token?: string;
}

/**
 * Instagram engagement client: send DMs, post comment replies, verify webhooks.
 * Separate from InstagramService (which only handles posting) because the
 * endpoints, scopes, and lifecycle are different.
 */
export class InstagramEngagementService {
  constructor(private credentials: InstagramEngagementCredentials) {}

  /**
   * Sends a text Direct Message to a customer.
   * NOTE: Subject to Instagram's 24-hour customer service window — outside
   * that window, only message tags / human agent windows work.
   */
  async sendTextDm(recipientIgId: string, text: string): Promise<InstagramSendDmResult> {
    const payload = {
      recipient: { id: recipientIgId },
      message: { text },
    };

    const res = await this.graphPost<InstagramSendApiResponse>(
      `/${this.credentials.account_id}/messages`,
      payload
    );

    return {
      messageId: res.message_id ?? res.id ?? "",
      recipientId: res.recipient_id ?? recipientIgId,
    };
  }

  /**
   * Sends an image (already hosted at a public URL) as a Direct Message.
   * The Instagram Messaging API has no caption field on attachments — pair
   * this with a follow-up sendTextDm call if a caption is needed.
   */
  async sendImageDm(recipientIgId: string, imageUrl: string): Promise<InstagramSendDmResult> {
    const payload = {
      recipient: { id: recipientIgId },
      message: { attachment: { type: "image", payload: { url: imageUrl } } },
    };

    const res = await this.graphPost<InstagramSendApiResponse>(
      `/${this.credentials.account_id}/messages`,
      payload
    );

    return {
      messageId: res.message_id ?? res.id ?? "",
      recipientId: res.recipient_id ?? recipientIgId,
    };
  }

  /**
   * Marks an incoming Instagram message as "seen".
   */
  async markSeen(recipientIgId: string): Promise<void> {
    await this.graphPost(`/${this.credentials.account_id}/messages`, {
      recipient: { id: recipientIgId },
      sender_action: "mark_seen",
    });
  }

  /**
   * Posts a reply to a comment on one of YOUR posts.
   * Replies are nested under the parent comment in Instagram's UI.
   */
  async replyToComment(parentCommentId: string, message: string): Promise<InstagramReplyCommentResult> {
    const payload = {
      message,
    };
    const res = await this.graphPost<InstagramSendApiResponse>(
      `/${parentCommentId}/replies`,
      payload
    );
    return { commentId: res.id ?? "" };
  }

  /**
   * Verifies the webhook subscription handshake.
   */
  verifyWebhookSubscription(
    mode: string | null,
    token: string | null,
    challenge: string | null
  ): string | null {
    if (!this.credentials.verify_token) return null;
    if (mode === "subscribe" && token === this.credentials.verify_token && challenge) {
      return challenge;
    }
    return null;
  }

  /**
   * Verifies the HMAC-SHA256 signature Meta includes on every webhook POST.
   * Header: X-Hub-Signature-256: sha256=<hex>
   *
   * rawBody MUST be the raw bytes Meta sent — JSON.stringify of parsed body
   * will not match because of whitespace differences.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!this.credentials.app_secret) return false;
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
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

  /**
   * Fetches a user's Instagram profile info (username, name, profile pic).
   * Useful when a webhook delivers an unknown sender ID.
   */
  async fetchUserProfile(igUserId: string): Promise<{ username?: string; name?: string }> {
    const url = `${IG_GRAPH_BASE_URL}/${igUserId}?fields=username,name&access_token=${this.credentials.access_token}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return {};
      const data = (await res.json()) as { username?: string; name?: string };
      return { username: data.username, name: data.name };
    } catch {
      return {};
    }
  }

  // ── Internal HTTP helper ─────────────────────────────────────────────
  private async graphPost<T>(path: string, payload: unknown): Promise<T> {
    const url = `${IG_GRAPH_BASE_URL}${path}?access_token=${this.credentials.access_token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg =
        (data as { error?: { message?: string } })?.error?.message ??
        "Instagram engagement API error";
      throw new InstagramEngagementApiError(errMsg, res.status, data);
    }
    return data as T;
  }
}
