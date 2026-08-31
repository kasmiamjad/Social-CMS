/** The dashboard's status buckets. Mirrors CALL_STATUS_VALUES from lib/lead-status.ts,
 * with "unread"+"read" collapsed into a single "pending" bucket so every lead
 * lands in exactly one bucket and totals reconcile. */
export const A360_STATUS_VALUES = [
  "converted",
  "follow_up",
  "not_interested",
  "link_send",
  "unanswered",
  "pending",
] as const;

export type A360Status = (typeof A360_STATUS_VALUES)[number];

export const A360_STATUS_LABELS: Record<A360Status, string> = {
  converted: "Converted",
  follow_up: "Follow-up",
  not_interested: "Not Interested",
  link_send: "Link Sent",
  unanswered: "Unanswered",
  pending: "Pending",
};

/** Reuses the exact Tailwind classes already defined for call_status badges
 * elsewhere in the app (src/lib/lead-status.ts) — "pending" (unread/read)
 * gets the neutral "read" styling since it's not one of the 7 named statuses. */
export const A360_STATUS_BADGE_CLASS: Record<A360Status, string> = {
  converted: "bg-success/15 text-success",
  follow_up: "bg-violet-500/15 text-violet-400",
  not_interested: "bg-error/15 text-error",
  link_send: "bg-sky-500/15 text-sky-400",
  unanswered: "bg-amber-500/15 text-amber-400",
  pending: "bg-surface text-text-muted border border-border",
};

export const A360_STATUS_DOT_CLASS: Record<A360Status, string> = {
  converted: "bg-success",
  follow_up: "bg-violet-500",
  not_interested: "bg-error",
  link_send: "bg-sky-500",
  unanswered: "bg-amber-500",
  pending: "bg-text-muted",
};

/** Literal hex colors for recharts (SVG fill/stroke needs real color strings,
 * not Tailwind classes) — matches the Tailwind classes above exactly. */
export const A360_STATUS_HEX: Record<A360Status, string> = {
  converted: "#2DD4BF", // success / teal
  follow_up: "#8B5CF6", // violet-500
  not_interested: "#F87171", // error
  link_send: "#0EA5E9", // sky-500 / primary
  unanswered: "#F59E0B", // amber-500
  pending: "#94A3B8", // text-muted
};

/** Maps a raw call_status column value (including unread/read) to a dashboard bucket. */
export function toA360Status(callStatus: string | null): A360Status {
  if (callStatus === "converted") return "converted";
  if (callStatus === "follow_up") return "follow_up";
  if (callStatus === "not_interested") return "not_interested";
  if (callStatus === "link_send") return "link_send";
  if (callStatus === "unanswered") return "unanswered";
  return "pending"; // unread, read, or null
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

export type A360TrendPoint = { date: string } & Record<A360Status, number>;

export interface A360AgentSummary {
  agentName: string;
  totalAssigned: number;
  followUpQueue: number;
  linkSent: number;
  converted: number;
  notInterested: number;
  conversionRatePct: number;
}
