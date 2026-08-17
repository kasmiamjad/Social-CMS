"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Check, Loader2 } from "lucide-react";

export interface FollowupChip {
  id: string;
  lead_id: string;
  lead_name: string;
  follow_up_date: string;
  note: string | null;
  logged_by: string | null;
  completed_at: string | null;
}

interface DayFollowupsDrawerProps {
  date: string;
  entries: FollowupChip[];
  onClose: () => void;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** Side panel listing every follow-up logged for a single calendar day. */
export function DayFollowupsDrawer({ date, entries, onClose }: DayFollowupsDrawerProps) {
  const router = useRouter();
  const [items, setItems] = useState(entries);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(entries);
  }, [entries]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleToggle(entry: FollowupChip) {
    setTogglingId(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${entry.lead_id}/followups/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !entry.completed_at }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to update follow-up");
        return;
      }
      setItems((prev) =>
        prev.map((p) => (p.id === entry.id ? { ...p, completed_at: json.data.followup.completed_at } : p))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[420px] bg-surface-elevated border-l border-border z-50 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Follow-ups</h2>
            <p className="text-xs text-text-muted mt-0.5">{DATE_FMT.format(new Date(`${date}T00:00:00`))}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="text-xs text-error mb-3">{error}</p>}
          {items.length === 0 ? (
            <p className="text-sm text-text-muted">No follow-ups this day.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((e) => {
                const done = Boolean(e.completed_at);
                return (
                  <li key={e.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/leads/${e.lead_id}`}
                        className={`text-sm font-semibold hover:text-primary-hover ${
                          done ? "text-text-muted line-through" : "text-primary"
                        }`}
                      >
                        {e.lead_name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggle(e)}
                        disabled={togglingId === e.id}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border shrink-0 transition-colors ${
                          done
                            ? "bg-success/10 border-success/40 text-success hover:bg-success/20"
                            : "border-border text-text-muted hover:border-primary hover:text-primary"
                        }`}
                      >
                        {togglingId === e.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} strokeWidth={3} />
                        )}
                        {done ? "Done" : "Mark done"}
                      </button>
                    </div>
                    {e.logged_by && <div className="text-xs text-text-muted mt-0.5">{e.logged_by}</div>}
                    {e.note && (
                      <p className={`text-sm mt-1 ${done ? "text-text-muted/70" : "text-text-muted"}`}>{e.note}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
