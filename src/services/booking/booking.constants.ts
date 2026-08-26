/**
 * Booking confirmation constants + customer-message builders.
 *
 * The WhatsApp confirmation is always sent as free text — Baileys (WhatsApp
 * Web link) has no 24-hour-window restriction or template mechanism the way
 * Meta's Cloud API did.
 */

/**
 * Master switch for auto-sending the WhatsApp confirmation.
 * OFF for now — the UI shows a copy-paste box instead. Flip to `true` to
 * enable automatic delivery.
 */
export const BOOKING_WHATSAPP_AUTOSEND: boolean = false;

/** Timezone used to render the installation date/time for the customer. */
export const BOOKING_DISPLAY_TIMEZONE = "Asia/Riyadh";

export interface BookingMessageFields {
  clientName: string;
  bookingRef: string;
  product: string;
  qty: number;
  /** Pre-formatted total, e.g. "1,398" (currency added separately). */
  totalFormatted: string;
  currency: string;
  /** Pre-formatted date, e.g. "Mon, 16 Jun 2026". */
  dateFormatted: string;
  /** Pre-formatted time or slot label, e.g. "2:30 PM" or "Morning 9–12". */
  timeFormatted: string;
}

/**
 * Builds the free-form text confirmation (used inside the 24h window).
 * Mirrors the body of the approved template so customers see consistent copy.
 */
export function buildBookingFreeText(f: BookingMessageFields): string {
  return [
    `Hello ${f.clientName}, your SA'DA H2O order is confirmed! ✅`,
    ``,
    `📋 Ref: ${f.bookingRef}`,
    `📦 Product: ${f.product} (×${f.qty})`,
    `💰 Total: ${f.currency} ${f.totalFormatted}`,
    `📅 Installation: ${f.dateFormatted} at ${f.timeFormatted}`,
    ``,
    `Need a different time? Just reply with your preferred date & time.`,
  ].join("\n");
}

/** Composes the human-friendly booking reference, e.g. "SADA-2026-0042". */
export function composeBookingRef(serial: number, year: number): string {
  return `SADA-${year}-${String(serial).padStart(4, "0")}`;
}

/** Formats an ISO timestamp to "Mon, 16 Jun 2026" in the display timezone. */
export function formatBookingDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_DISPLAY_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Formats an ISO timestamp to "2:30 PM" in the display timezone. */
export function formatBookingTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_DISPLAY_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
