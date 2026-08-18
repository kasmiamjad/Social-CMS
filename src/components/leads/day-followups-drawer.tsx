"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { DayFollowupsPanel, type FollowupChip } from "./day-followups-panel";

export type { FollowupChip };

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

/** Side panel listing every follow-up logged for a single calendar day, plus a form to add a new one for that day. */
export function DayFollowupsDrawer({ date, entries, onClose }: DayFollowupsDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[420px] bg-surface-elevated border-l border-border z-50 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
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
          <DayFollowupsPanel date={date} entries={entries} />
        </div>
      </aside>
    </>
  );
}
