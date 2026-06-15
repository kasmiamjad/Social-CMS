/**
 * Booking confirmation constants + customer-message builders.
 *
 * Two delivery paths exist for the WhatsApp confirmation:
 *   - free_text: allowed only inside the 24-hour customer service window.
 *   - template:  a pre-approved Meta template, required outside that window.
 * Both paths must convey the SAME information (ref, product, total, date/time),
 * so the formatting helpers below are shared.
 */

/**
 * Master switch for auto-sending the WhatsApp confirmation.
 * OFF for now — the `booking_confirmation` template isn't approved yet, so the
 * UI shows a copy-paste box instead. Flip to `true` once Meta approves the
 * template to re-enable automatic delivery (free-text / template path).
 */
export const BOOKING_WHATSAPP_AUTOSEND: boolean = false;

/** Name of the approved template in Meta Business Manager (body has 7 variables). */
export const BOOKING_TEMPLATE_NAME = "booking_confirmation";

/** Language code the template was submitted under. */
export const BOOKING_TEMPLATE_LANGUAGE = "en";

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
    `Reply here to reschedule.`,
  ].join("\n");
}

/**
 * Builds the Meta template `components` array. The approved template body must
 * use {{1}}..{{7}} in this exact order:
 *   1 name, 2 ref, 3 product, 4 qty, 5 total, 6 date, 7 time.
 */
export function buildBookingTemplateComponents(f: BookingMessageFields): unknown[] {
  const text = (s: string) => ({ type: "text", text: s });
  return [
    {
      type: "body",
      parameters: [
        text(f.clientName),
        text(f.bookingRef),
        text(f.product),
        text(String(f.qty)),
        text(`${f.currency} ${f.totalFormatted}`),
        text(f.dateFormatted),
        text(f.timeFormatted),
      ],
    },
  ];
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
