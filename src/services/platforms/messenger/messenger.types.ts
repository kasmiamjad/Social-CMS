/**
 * Facebook Messenger Platform type definitions.
 * See: https://developers.facebook.com/docs/messenger-platform
 */

export interface MessengerCredentials {
  /** The Facebook Page ID the bot replies as. */
  page_id: string;
  /** Page access token used to call the Send API. */
  page_access_token: string;
  /** App secret — verifies webhook HMAC signatures. */
  app_secret: string;
  /** Verify token echoed during the webhook handshake. */
  verify_token: string;
  /** Meta app id (optional, informational). */
  app_id?: string;
}

export interface MessengerSendResult {
  messageId: string;
}

export interface MessengerSendApiResponse {
  recipient_id: string;
  message_id: string;
}

export interface MessengerApiErrorResponse {
  error: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

// ── Incoming webhook payload shapes ────────────────────────────────────────

export interface MessengerWebhookPayload {
  object: "page";
  entry: MessengerWebhookEntry[];
}

export interface MessengerWebhookEntry {
  id: string; // the Page id
  time: number;
  messaging?: MessengerMessagingEvent[];
}

export interface MessengerMessagingEvent {
  sender: { id: string }; // PSID of the customer
  recipient: { id: string }; // the Page id
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    /** True for messages the Page itself sent (echoes) — ignore these. */
    is_echo?: boolean;
    attachments?: Array<{
      type: "image" | "audio" | "video" | "file" | "location" | "fallback";
      payload: { url?: string };
    }>;
  };
  postback?: { title?: string; payload?: string; mid?: string };
}
