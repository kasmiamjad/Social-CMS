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

/** Reuses the exact Tailwind classes already defined for call_status badges
 * elsewhere in the app (src/lib/lead-status.ts). */
export const A360_STATUS_BADGE_CLASS: Record<A360Status, string> = {
  unread: "bg-primary/15 text-primary",
  read: "bg-surface text-text-muted border border-border",
  follow_up: "bg-violet-500/15 text-violet-400",
  unanswered: "bg-amber-500/15 text-amber-400",
  not_interested: "bg-error/15 text-error",
  link_send: "bg-cyan-500/15 text-cyan-400",
  converted: "bg-success/15 text-success",
};

export const A360_STATUS_DOT_CLASS: Record<A360Status, string> = {
  unread: "bg-primary",
  read: "bg-text-muted",
  follow_up: "bg-violet-500",
  unanswered: "bg-amber-500",
  not_interested: "bg-error",
  link_send: "bg-cyan-500",
  converted: "bg-success",
};

/** Literal hex colors for recharts (SVG fill/stroke needs real color strings,
 * not Tailwind classes) — 7 deliberately distinct hues so all lines stay
 * legible together on one chart (badges elsewhere use link_send=sky-500,
 * same as primary/unread — fine for a single badge, not for 7 overlapping
 * lines, hence cyan here instead). */
export const A360_STATUS_HEX: Record<A360Status, string> = {
  unread: "#3B82F6", // blue-500
  read: "#94A3B8", // text-muted / slate-400
  follow_up: "#8B5CF6", // violet-500
  unanswered: "#F59E0B", // amber-500
  not_interested: "#F87171", // error
  link_send: "#06B6D4", // cyan-500
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
