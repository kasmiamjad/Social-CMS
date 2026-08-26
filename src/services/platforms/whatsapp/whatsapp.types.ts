/**
 * Transport-agnostic WhatsApp message shapes shared by the auto-reply
 * pipeline and the Baileys adapter that feeds it. These used to mirror
 * Meta Cloud API's webhook payload (deferred media-by-id fetch); Baileys
 * downloads media synchronously off the event instead, so media bytes are
 * passed alongside the message rather than referenced by id.
 */

export interface WhatsAppContact {
  name: string | null;
}

export interface WhatsAppInboundMedia {
  buffer: Buffer;
  contentType: string;
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
  image?: { caption?: string };
  audio?: { voice?: boolean };
  video?: { caption?: string };
  document?: { filename?: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
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
