export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { getTechSession } from "@/lib/tech-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobCard, type TechJob } from "@/components/tech/job-card";
import { RIYADH_TZ } from "@/lib/booking-display";

// ── Calendar date helpers ───────────────────────────────────────────────────
// A "day" here is a Riyadh calendar date (YYYY-MM-DD). We do the week math in
// UTC-anchored Date objects (midnight Z) so server timezone never shifts a day.

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as a Riyadh calendar date string. */
function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

function dateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, n: number): string {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToYmd(d);
}

/** The Saturday on or before the given day (Saudi work week starts Saturday). */
function weekStart(ymd: string): string {
  const dow = ymdToDate(ymd).getUTCDay(); // 0=Sun … 6=Sat
  const offset = (dow + 1) % 7; // days since Saturday
  return addDays(ymd, -offset);
}

// UTC formatters applied to the midnight-Z anchor render the intended calendar date.
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
const DAYNUM_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" });
const SELECTED_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const RANGE_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

// Maps a booking's timestamp to its Riyadh calendar date for grouping.
const DAY_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: RIYADH_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default async function TechSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getTechSession();
  if (!session) return null;

  const today = riyadhToday();
  const sp = await searchParams;
  const selected = sp.date && YMD_RE.test(sp.date) ? sp.date : today;

  const start = weekStart(selected);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "id, scheduled_at, slot_label, product_snapshot, qty_snapshot, status, lead:leads(client_name, client_phone, location_url, location_address)"
    )
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .neq("status", "cancelled")
    .gte("scheduled_at", `${start}T00:00:00+03:00`)
    .lte("scheduled_at", `${end}T23:59:59+03:00`)
    .order("scheduled_at", { ascending: true });

  const jobs = (data ?? []) as unknown as TechJob[];

  // Group by Riyadh day for the strip counts + the selected-day list.
  const byDay = new Map<string, TechJob[]>();
  for (const job of jobs) {
    const key = DAY_KEY_FMT.format(new Date(job.scheduled_at));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(job);
    else byDay.set(key, [job]);
  }
  const selectedJobs = byDay.get(selected) ?? [];

  const prevWeek = addDays(start, -7);
  const nextWeek = addDays(start, 7);
  const weekRange = `${RANGE_FMT.format(ymdToDate(start))} – ${RANGE_FMT.format(ymdToDate(end))}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">Schedule</h1>
        {selected !== today && (
          <Link
            href="/tech/schedule"
            className="text-xs font-semibold text-primary hover:text-primary-hover"
          >
            Today
          </Link>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-2">
        <Link
          href={`/tech/schedule?date=${prevWeek}`}
          className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
          aria-label="Previous week"
        >
          <ChevronLeft size={16} strokeWidth={1.8} />
        </Link>
        <span className="text-sm font-medium text-foreground">{weekRange}</span>
        <Link
          href={`/tech/schedule?date=${nextWeek}`}
          className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
          aria-label="Next week"
        >
          <ChevronRight size={16} strokeWidth={1.8} />
        </Link>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1 mb-5">
        {days.map((d) => {
          const count = (byDay.get(d) ?? []).length;
          const isSelected = d === selected;
          const isToday = d === today;
          const anchor = ymdToDate(d);
          return (
            <Link
              key={d}
              href={`/tech/schedule?date=${d}`}
              className={[
                "flex flex-col items-center rounded-lg py-2 transition-colors",
                isSelected
                  ? "bg-primary text-white"
                  : "border border-border text-foreground hover:bg-surface",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[10px] uppercase tracking-wide",
                  isSelected ? "text-white/80" : "text-text-muted",
                ].join(" ")}
              >
                {WEEKDAY_FMT.format(anchor)}
              </span>
              <span className="text-sm font-semibold mt-0.5">{DAYNUM_FMT.format(anchor)}</span>
              {/* Job-count dot; today gets a ring when not selected. */}
              <span
                className={[
                  "mt-1 h-1.5 w-1.5 rounded-full",
                  count === 0
                    ? "bg-transparent"
                    : isSelected
                      ? "bg-white"
                      : isToday
                        ? "bg-primary"
                        : "bg-text-muted",
                ].join(" ")}
              />
            </Link>
          );
        })}
      </div>

      {/* Selected day */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          {SELECTED_FMT.format(ymdToDate(selected))}
          {selected === today && <span className="text-primary"> · Today</span>}
        </h2>
        <span className="text-xs text-text-muted">
          {selectedJobs.length === 0
            ? "No jobs"
            : `${selectedJobs.length} job${selectedJobs.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {selectedJobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center">
          <CalendarRange size={24} strokeWidth={1.5} className="text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">Nothing scheduled for this day.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {selectedJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
