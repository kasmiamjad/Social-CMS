/**
 * The lead triage workflow (separate from the sales pipeline `status` field):
 * a lead starts `unread` when it's auto-created from an inbound WhatsApp/
 * Messenger/Instagram message, flips to `read` the moment a team member
 * opens it, then moves through the call outcomes below.
 */
export const CALL_STATUS_VALUES = [
  "unread",
  "read",
  "follow_up",
  "unanswered",
  "not_interested",
  "link_send",
  "converted",
] as const;

export type CallStatus = (typeof CALL_STATUS_VALUES)[number];

export const CALL_STATUS_OPTIONS: { value: CallStatus; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "follow_up", label: "Follow-up" },
  { value: "unanswered", label: "Unanswered" },
  { value: "not_interested", label: "Not interested" },
  { value: "link_send", label: "Link sent" },
  { value: "converted", label: "Converted" },
];

export const CALL_STATUS_COLORS: Record<string, string> = {
  unread: "bg-primary/15 text-primary",
  read: "bg-surface text-text-muted",
  follow_up: "bg-violet-500/15 text-violet-600",
  unanswered: "bg-amber-500/15 text-amber-600",
  not_interested: "bg-error/15 text-error",
  link_send: "bg-sky-500/15 text-sky-600",
  converted: "bg-success/15 text-success",
};
