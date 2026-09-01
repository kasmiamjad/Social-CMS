"use client";

import { useState } from "react";
import { DayFollowupsDrawer, type FollowupChip } from "./day-followups-drawer";

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const DAYNUM_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" });

interface FollowupsWeekStripProps {
  /** The 7 dates (Sat→Fri) for this week, as YYYY-MM-DD strings. */
  days: string[];
  today: string;
  entriesByDay: Record<string, FollowupChip[]>;
}

/** One-row week view — bigger cells than the month grid since there are only 7. */
export function FollowupsWeekStrip({ days, today, entriesByDay }: FollowupsWeekStripProps) {
  const [activeDate, setActiveDate] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[700px] grid grid-cols-7 gap-3">
          {days.map((dateStr) => {
            const dayEntries = entriesByDay[dateStr] ?? [];
            const isToday = dateStr === today;
            const dayIsPastDue = dateStr < today;
            const hasPending = dayEntries.some((e) => !e.completed_at);
            const anchor = new Date(`${dateStr}T00:00:00Z`);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setActiveDate(dateStr)}
                className={`min-h-[220px] p-3 rounded-xl border text-left transition-colors ${
                  isToday ? "border-primary/40 bg-primary/5" : "border-border bg-surface-elevated hover:bg-surface"
                } ${dayIsPastDue && hasPending ? "ring-1 ring-inset ring-error/30" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">
                    {WEEKDAY_FMT.format(anchor)}
                  </span>
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-primary text-black" : "text-foreground"
                    }`}
                  >
                    {DAYNUM_FMT.format(anchor)}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEntries.slice(0, 6).map((e) => {
                    const done = Boolean(e.completed_at);
                    const overdue = !done && dayIsPastDue;
                    return (
                      <div
                        key={e.id}
                        className={`truncate text-[11px] px-1.5 py-0.5 rounded ${
                          done
                            ? "bg-success/10 text-success line-through"
                            : overdue
                              ? "bg-error/10 text-error"
                              : "bg-primary/10 text-primary"
                        }`}
                      >
                        {e.lead_name}
                      </div>
                    );
                  })}
                  {dayEntries.length > 6 && (
                    <div className="text-[10px] text-text-muted px-1.5">+{dayEntries.length - 6} more</div>
                  )}
                  {dayEntries.length === 0 && <div className="text-[11px] text-text-muted/60">—</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {activeDate && (
        <DayFollowupsDrawer
          date={activeDate}
          entries={entriesByDay[activeDate] ?? []}
          onClose={() => setActiveDate(null)}
        />
      )}
    </>
  );
}
