"use client";

import { useState } from "react";
import { FollowupDrawer, type FollowupChip } from "./followup-drawer";

const WEEKDAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

interface FollowupsCalendarGridProps {
  cells: (number | null)[];
  month: string;
  today: string;
  entriesByDay: Record<string, FollowupChip[]>;
}

/** Month grid — clicking a follow-up chip opens a side drawer instead of navigating away. */
export function FollowupsCalendarGrid({ cells, month, today, entriesByDay }: FollowupsCalendarGridProps) {
  const [active, setActive] = useState<FollowupChip | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[700px] rounded-xl border border-border bg-surface-elevated overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-center"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) {
                return (
                  <div key={i} className="min-h-[110px] border-b border-r border-border last:border-r-0" />
                );
              }
              const dateStr = `${month}-${String(day).padStart(2, "0")}`;
              const dayEntries = entriesByDay[dateStr] ?? [];
              const isToday = dateStr === today;
              const dayIsPastDue = dateStr < today;
              const shown = dayEntries.slice(0, 3);
              const extra = dayEntries.length - shown.length;
              return (
                <div
                  key={i}
                  className="min-h-[110px] p-1.5 border-b border-r border-border last:border-r-0 [&:nth-child(7n)]:border-r-0"
                >
                  <div
                    className={`text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday ? "bg-primary text-white" : "text-foreground"
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-1">
                    {shown.map((e) => {
                      const done = Boolean(e.completed_at);
                      const overdue = !done && dayIsPastDue;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setActive(e)}
                          title={e.note ?? undefined}
                          className={`block w-full truncate text-left text-[11px] px-1.5 py-0.5 rounded ${
                            done
                              ? "bg-success/10 text-success line-through hover:bg-success/20"
                              : overdue
                                ? "bg-error/10 text-error hover:bg-error/20"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {e.lead_name}
                        </button>
                      );
                    })}
                    {extra > 0 && <div className="text-[10px] text-text-muted px-1.5">+{extra} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {active && <FollowupDrawer entry={active} onClose={() => setActive(null)} />}
    </>
  );
}
