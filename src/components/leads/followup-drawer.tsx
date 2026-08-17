"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X, Check, ExternalLink } from "lucide-react";

export interface FollowupChip {
  id: string;
  lead_id: string;
  lead_name: string;
  follow_up_date: string;
  note: string | null;
  logged_by: string | null;
  completed_at: string | null;
}

interface FollowupDrawerProps {
  entry: FollowupChip;
  onClose: () => void;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" });

/** Side panel for a single follow-up, opened from a calendar day chip. */
export function FollowupDrawer({ entry, onClose }: FollowupDrawerProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(entry);
  }, [entry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleToggle() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${current.lead_id}/followups/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !current.completed_at }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to update follow-up");
        return;
      }
      setCurrent((prev) => ({ ...prev, completed_at: json.data.followup.completed_at }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const done = Boolean(current.completed_at);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[380px] bg-surface-elevated border-l border-border z-50 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Follow-up</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Link
            href={`/leads/${current.lead_id}`}
            className="text-base font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
          >
            {current.lead_name}
            <ExternalLink size={13} strokeWidth={2} />
          </Link>
          <div className="text-sm text-text-muted">
            {DATE_FMT.format(new Date(current.follow_up_date))}
            {current.logged_by && ` · ${current.logged_by}`}
          </div>
          {current.note && (
            <p className="text-sm text-foreground whitespace-pre-wrap">{current.note}</p>
          )}
          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border">
          <Button
            type="button"
            onClick={handleToggle}
            loading={saving}
            variant={done ? "secondary" : "primary"}
            className="w-full"
          >
            <Check size={14} strokeWidth={3} />
            {done ? "Mark as not done" : "Mark done"}
          </Button>
        </div>
      </aside>
    </>
  );
}
