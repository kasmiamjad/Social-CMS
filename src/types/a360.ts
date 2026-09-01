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

/** "Sunset Glow" palette, applied per status on request — a custom 7-color
 * gradient (not any of this app's semantic tokens or Tailwind's named
 * palette), so badge/dot classes below use arbitrary-value Tailwind
 * classes to stay pixel-accurate to the requested hex values. */
export const A360_STATUS_BADGE_CLASS: Record<A360Status, string> = {
  read: "bg-[#F94144]/15 text-[#F94144]",
  unread: "bg-[#F3722C]/15 text-[#F3722C]",
  unanswered: "bg-[#F8961E]/15 text-[#F8961E]",
  not_interested: "bg-[#F9C74F]/15 text-[#F9C74F]",
  link_send: "bg-[#90BE6D]/15 text-[#90BE6D]",
  follow_up: "bg-[#43AA8B]/15 text-[#43AA8B]",
  converted: "bg-[#577590]/15 text-[#577590]",
};

export const A360_STATUS_DOT_CLASS: Record<A360Status, string> = {
  read: "bg-[#F94144]",
  unread: "bg-[#F3722C]",
  unanswered: "bg-[#F8961E]",
  not_interested: "bg-[#F9C74F]",
  link_send: "bg-[#90BE6D]",
  follow_up: "bg-[#43AA8B]",
  converted: "bg-[#577590]",
};

/** Literal hex colors for recharts (SVG fill/stroke needs real color strings,
 * not Tailwind classes) — matches the Tailwind classes above exactly. */
export const A360_STATUS_HEX: Record<A360Status, string> = {
  read: "#F94144",
  unread: "#F3722C",
  unanswered: "#F8961E",
  not_interested: "#F9C74F",
  link_send: "#90BE6D",
  follow_up: "#43AA8B",
  converted: "#577590",
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
