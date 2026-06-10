/**
 * Instagram engagement (DMs + comments) type definitions.
 */

export interface InstagramAIDecision {
  should_reply: boolean;
  reply: string | null;
  intent: string | null;
}

export interface InstagramSendDmResult {
  messageId: string;
  recipientId: string;
}

export interface InstagramReplyCommentResult {
  commentId: string;
}

export interface InstagramSendApiResponse {
  recipient_id?: string;
  message_id?: string;
  id?: string;
}

// ── Webhook payload shapes (Instagram messaging via Meta) ───────────────

export interface InstagramWebhookPayload {
  object: "instagram";
  entry: InstagramWebhookEntry[];
}

export interface InstagramWebhookEntry {
  id: string;
  time: number;
  // DM events
  messaging?: InstagramMessagingEvent[];
  // Comment + media events
  changes?: InstagramChangeEvent[];
}

// ── DM events ──────────────────────────────────────────────────────────
export interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: InstagramDmMessage;
  postback?: InstagramPostback;
  reaction?: InstagramReaction;
  read?: { mid: string };
}

export interface InstagramDmMessage {
  mid: string;
  text?: string;
  is_echo?: boolean; // true when WE sent the message
  attachments?: Array<{
    type: "image" | "video" | "audio" | "file" | "story_mention" | "share";
    payload: { url?: string };
  }>;
  reply_to?: { mid: string; story?: { id: string; url?: string } };
}

export interface InstagramPostback {
  mid: string;
  title: string;
  payload: string;
}

export interface InstagramReaction {
  mid: string;
  action: "react" | "unreact";
  reaction?: string;
  emoji?: string;
}

// ── Comment events ─────────────────────────────────────────────────────
export interface InstagramChangeEvent {
  field: "comments" | "mentions" | "live_comments";
  value: InstagramCommentValue;
}

export interface InstagramCommentValue {
  from?: { id: string; username?: string };
  media?: { id: string; media_product_type?: string; ad_id?: string };
  id: string; // comment id
  parent_id?: string; // parent comment id (for replies)
  text: string;
  comment_id?: string;
}
