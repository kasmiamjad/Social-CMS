/**
 * WhatsApp Cloud API type definitions.
 * See: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export interface WhatsAppCredentials {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  app_id: string;
  app_secret: string;
  verify_token: string;
}

export interface WhatsAppSendTextResult {
  messageId: string;
}

export interface WhatsAppSendApiResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

export interface WhatsAppApiErrorResponse {
  error: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

// ── Incoming webhook payload shapes ────────────────────────────────────────

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: "messages";
}

export interface WhatsAppWebhookValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppStatusUpdate[];
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type:
    | "text"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "sticker"
    | "location"
    | "interactive"
    | "button";
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string; sha256: string; voice?: boolean };
  video?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type: string; sha256: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

export interface WhatsAppStatusUpdate {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

// ── AI decision contract ───────────────────────────────────────────────────

/**
 * Structured lead info extracted by the AI when it has finished the
 * qualification flow and just sent the summary. The auto-reply service
 * uses these fields to auto-create a row in the `leads` table.
 */
export interface WhatsAppAILeadData {
  client_name?: string | null;
  business_type?: string | null;
  location_text?: string | null;
  product_model?: string | null;
  product_qty?: number | null;
  remarks?: string | null;
}

export interface WhatsAppAIDecision {
  should_reply: boolean;
  reply: string | null;
  intent: string | null;
  /** Set to true when AI has collected all qualification info and is sending the summary. */
  lead_ready?: boolean;
  /** Filled in alongside lead_ready=true. */
  lead_data?: WhatsAppAILeadData;
  /**
   * Optional list of product image URLs to send BEFORE the text reply.
   * Only populate when the customer explicitly asks for photos/pictures.
   * Each URL must be publicly accessible over HTTPS.
   */
  images_to_send?: string[];
  /**
   * Reschedule signal for a customer who already has a confirmed booking.
   * intent "propose" carries the parsed new_datetime_iso (or null if no time given).
   */
  reschedule?: {
    intent: "propose" | "confirm" | "cancel" | "none";
    new_datetime_iso: string | null;
  };
}
