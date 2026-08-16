/** Fixed list of staff who can be assigned a lead. Update here if the team changes. */
export const TEAM_MEMBERS = ["Fateen", "Mariyam", "Nahan"] as const;
export type TeamMember = (typeof TEAM_MEMBERS)[number];

/** Badge color per team member, so the same person reads the same color everywhere. */
export const TEAM_MEMBER_COLORS: Record<string, string> = {
  Fateen: "bg-blue-500/15 text-blue-600",
  Mariyam: "bg-rose-500/15 text-rose-600",
  Nahan: "bg-pink-500/15 text-pink-600",
};

const ACTING_AS_KEY = "sada_acting_as";

/** Reads the team member "acting as" on this device/browser, if one has been picked. */
export function getActingAs(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTING_AS_KEY);
}

/** Persists which team member is "acting as" the current user on this device/browser. */
export function setActingAs(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTING_AS_KEY, name);
}
