/** A360's own accent color (lime green) — matches the original
 * a360crm-view dashboard being recreated here. Kept as a literal outside
 * branding.ts like the Messenger/Instagram brand colors in
 * components/dashboard/channels-card.tsx, since it's specific to this one
 * section, not the app's SA'DA H2O identity. */
export const A360_ACCENT = "#A3E635";
export const A360_ACCENT_ON = "#000000"; // text/icon color on top of the accent fill

/** The dashboard's status buckets — the exact 7 call_status values from
 * lib/lead-status.ts, kept distinct (unread and read are NOT collapsed) so
 * every status is individually visible in the donut/trend/badges. */
export const A360_STATUS_VALUES = [
  "unread",
  "read",
  "follow_up",
  "unanswered",
  "not_interested",
  "link_send",
  "converted",
] as const;

export type A360Status = (typeof A360_STATUS_VALUES)[number];

export const A360_STATUS_LABELS: Record<A360Status, string> = {
  unread: "Unread",
  read: "Read",
  follow_up: "Follow-up",
  unanswered: "Unanswered",
  not_interested: "Not Interested",
  link_send: "Link Sent",
  converted: "Converted",
};

/** Matches the reference a360crm-view dashboard's exact per-status palette
 * (Converted=teal, Follow-up=amber, Not Interested=red, Link Sent=violet,
 * Unanswered=muted slate); Unread/Read are this app's own addition
 * (not present in the original 5-status version) so get their own
 * non-colliding colors (blue / light gray). */
export const A360_STATUS_BADGE_CLASS: Record<A360Status, string> = {
  unread: "bg-primary/15 text-primary",
  read: "bg-surface text-text-muted border border-border",
  follow_up: "bg-amber-500/15 text-amber-400",
  unanswered: "bg-slate-500/15 text-slate-400",
  not_interested: "bg-error/15 text-error",
  link_send: "bg-violet-500/15 text-violet-400",
  converted: "bg-success/15 text-success",
};

export const A360_STATUS_DOT_CLASS: Record<A360Status, string> = {
  unread: "bg-primary",
  read: "bg-text-muted",
  follow_up: "bg-amber-500",
  unanswered: "bg-slate-500",
  not_interested: "bg-error",
  link_send: "bg-violet-500",
  converted: "bg-success",
};

/** Literal hex colors for recharts (SVG fill/stroke needs real color strings,
 * not Tailwind classes) — matches the Tailwind classes above exactly. */
export const A360_STATUS_HEX: Record<A360Status, string> = {
  unread: "#3B82F6", // blue-500
  read: "#CBD5E1", // slate-300
  follow_up: "#F59E0B", // amber-500
  unanswered: "#64748B", // slate-500
  not_interested: "#EF4444", // red-500 — a more saturated red than the app's own error/#F87171 token, matching the reference dashboard's "Not Interested" color
  link_send: "#8B5CF6", // violet-500
  converted: "#2DD4BF", // success / teal
};

/** Maps a raw call_status column value to a dashboard bucket — null (leads
 * created before the call_status workflow existed) defaults to "unread". */
export function toA360Status(callStatus: string | null): A360Status {
  if ((A360_STATUS_VALUES as readonly string[]).includes(callStatus ?? "")) {
    return callStatus as A360Status;
  }
  return "unread";
}

export interface A360LeadRow {
  id: string;
  client_name: string;
  client_phone: string | null;
  city: string | null;
  assigned_to: string | null;
  call_status: string | null;
  remarks: string | null;
  internal_notes: string | null;
  created_at: string;
  /** Most recent still-pending follow-up date, from buildFollowupInfo() — null if none scheduled. */
  next_followup_date: string | null;
}

export interface A360StatusShare {
  status: A360Status;
  count: number;
  sharePct: number;
}

/** Per-day counts, one field per status plus a "total" across all of them. */
export type A360TrendPoint = { date: string; total: number } & Record<A360Status, number>;

export interface A360AgentSummary {
  agentName: string;
  totalAssigned: number;
  followUpQueue: number;
  linkSent: number;
  converted: number;
  notInterested: number;
  conversionRatePct: number;
}
