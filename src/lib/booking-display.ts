type BadgeVariant = "default" | "success" | "warning" | "error" | "processing";

/**
 * Shared booking-status presentation used across the technician panel
 * (job cards + the job detail screen). Keeping this in one place means the
 * status colours/labels stay consistent everywhere a booking is rendered.
 */
export const BOOKING_STATUS_VARIANT: Record<string, BadgeVariant> = {
  scheduled: "processing",
  confirmed: "processing",
  on_the_way: "warning",
  arrived: "warning",
  completed: "success",
  cancelled: "error",
  no_show: "error",
};

/** Human-friendly label for a raw booking status. */
export function bookingStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

/** Variant for a status, falling back to a neutral badge for unknown values. */
export function bookingStatusVariant(status: string): BadgeVariant {
  return BOOKING_STATUS_VARIANT[status] ?? "default";
}

// All times in the business' timezone (Riyadh) so techs see the same wall-clock
// the customer was quoted, regardless of where the server/device runs.
export const RIYADH_TZ = "Asia/Riyadh";

export const BOOKING_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: RIYADH_TZ,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

export const BOOKING_DATE_LONG_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: RIYADH_TZ,
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export const BOOKING_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: RIYADH_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
