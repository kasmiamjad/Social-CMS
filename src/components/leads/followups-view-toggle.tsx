import Link from "next/link";

type FollowupView = "month" | "week" | "day";

interface FollowupsViewToggleProps {
  active: FollowupView;
  /** The anchor date (YYYY-MM-DD) carried over when switching views. */
  anchorDate: string;
}

const VIEWS: { id: FollowupView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

/** Month/Week/Day tab switcher for the Follow-ups calendar. */
export function FollowupsViewToggle({ active, anchorDate }: FollowupsViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-surface-elevated">
      {VIEWS.map((v) => (
        <Link
          key={v.id}
          href={`/leads/followups?view=${v.id}&date=${anchorDate}`}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            active === v.id ? "bg-primary text-black" : "text-text-muted hover:text-foreground"
          }`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
