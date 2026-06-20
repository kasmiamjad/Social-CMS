"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Navigation,
  MapPin,
  CheckCircle2,
  UserX,
  Loader2,
  Check,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bookingStatusLabel } from "@/lib/booking-display";

interface JobStatusActionsProps {
  bookingId: string;
  status: string;
  onTheWayAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  completionNotes: string | null;
}

type Target = "on_the_way" | "arrived" | "completed" | "no_show";

interface ActionDef {
  target: Target;
  label: string;
  icon: typeof Navigation;
  tone: "primary" | "danger";
  needsNotes?: boolean;
}

const ONWAY: ActionDef = { target: "on_the_way", label: "On my way", icon: Navigation, tone: "primary" };
const ARRIVED: ActionDef = { target: "arrived", label: "Arrived", icon: MapPin, tone: "primary" };
const COMPLETE: ActionDef = { target: "completed", label: "Complete job", icon: CheckCircle2, tone: "primary", needsNotes: true };
const NOSHOW: ActionDef = { target: "no_show", label: "No-show", icon: UserX, tone: "danger", needsNotes: true };

/** Contextual next-step actions for the current booking status. */
function nextActions(status: string): ActionDef[] {
  switch (status) {
    case "scheduled":
    case "confirmed":
      return [ONWAY, NOSHOW];
    case "on_the_way":
      return [ARRIVED, NOSHOW];
    case "arrived":
      return [COMPLETE, NOSHOW];
    case "no_show":
      // Recovery path if a no-show was logged by mistake.
      return [ONWAY, ARRIVED];
    default:
      return [];
  }
}

const STAMP_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function fmtStamp(iso: string): string {
  return STAMP_FMT.format(new Date(iso));
}

/**
 * Field status controls on the job detail screen. Advances the booking through
 * On my way → Arrived → Completed / No-show, stamping each step server-side.
 */
export function JobStatusActions({
  bookingId,
  status,
  onTheWayAt,
  arrivedAt,
  completedAt,
  completionNotes,
}: JobStatusActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When a notes-requiring action is tapped, we reveal a confirm panel for it.
  const [pending, setPending] = useState<ActionDef | null>(null);
  const [notes, setNotes] = useState("");

  const actions = nextActions(status);
  const locked = status === "completed" || status === "cancelled";

  const timeline = [
    { label: "On the way", at: onTheWayAt },
    { label: "Arrived", at: arrivedAt },
    { label: "Completed", at: completedAt },
  ].filter((s) => s.at);

  async function submit(target: Target, completionNotesValue?: string) {
    setBusy(target);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tech/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: target,
          ...(completionNotesValue !== undefined && { completion_notes: completionNotesValue }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "Could not update status.");
        setBusy(null);
        return;
      }
      setPending(null);
      setNotes("");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  function onAction(action: ActionDef) {
    setError(null);
    if (action.needsNotes) {
      setPending(action);
      setNotes("");
    } else {
      void submit(action.target);
    }
  }

  return (
    <div className="space-y-3">
      {/* Visit timeline */}
      {timeline.length > 0 && (
        <ul className="space-y-1.5">
          {timeline.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <Check size={14} strokeWidth={2.4} className="text-success shrink-0" />
              <span className="text-foreground font-medium">{s.label}</span>
              <span className="text-text-muted">· {fmtStamp(s.at!)}</span>
            </li>
          ))}
        </ul>
      )}

      {locked && (
        <div className="flex items-start gap-2 text-xs text-text-muted">
          <Lock size={13} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <span>
            This job is <span className="font-medium text-foreground">{bookingStatusLabel(status)}</span>. Contact
            the office if something needs to change.
          </span>
        </div>
      )}

      {completionNotes && (
        <div className="rounded-lg bg-surface p-3 text-xs text-foreground whitespace-pre-wrap">
          <div className="text-[11px] uppercase tracking-wide text-text-muted mb-1">Completion notes</div>
          {completionNotes}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-error/10 text-error text-xs px-3 py-2">{error}</div>
      )}

      {/* Notes confirm panel (for Complete / No-show) */}
      {pending ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-foreground">
            {pending.target === "no_show" ? "Reason (optional)" : "Completion notes (optional)"}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              pending.target === "no_show"
                ? "e.g. Customer not home, no answer on call"
                : "e.g. Installed unit, tested flow, briefed customer"
            }
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void submit(pending.target, notes.trim())}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60",
                pending.tone === "danger" ? "bg-error hover:bg-error/90" : "bg-primary hover:bg-primary-hover"
              )}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <pending.icon size={15} strokeWidth={1.8} />}
              Confirm {pending.label}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setPending(null);
                setNotes("");
              }}
              className="px-3 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-surface disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.target}
                type="button"
                disabled={busy !== null}
                onClick={() => onAction(action)}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60",
                  action.tone === "danger"
                    ? "border border-error/40 text-error hover:bg-error/10"
                    : "bg-primary hover:bg-primary-hover text-white"
                )}
              >
                {busy === action.target ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <action.icon size={15} strokeWidth={1.8} />
                )}
                {action.label}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
