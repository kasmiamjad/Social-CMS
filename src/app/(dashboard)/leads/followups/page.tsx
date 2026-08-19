export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import { FollowupsCalendarGrid } from "@/components/leads/followups-calendar-grid";
import { FollowupsWeekStrip } from "@/components/leads/followups-week-strip";
import { DayFollowupsPanel } from "@/components/leads/day-followups-panel";
import { FollowupsViewToggle } from "@/components/leads/followups-view-toggle";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { FollowupChip } from "@/components/leads/day-followups-drawer";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

// ── Calendar date helpers ───────────────────────────────────────────────────
// follow_up_date is a plain DATE column (YYYY-MM-DD, no time/timezone), so all
// math here is done on UTC-midnight anchors purely to avoid the server's local
// timezone shifting a day when formatting.

const YM_RE = /^\d{4}-\d{2}$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymToDate(ym: string): Date {
  return new Date(`${ym}-01T00:00:00Z`);
}

function addMonths(ym: string, n: number): string {
  const d = ymToDate(ym);
  d.setUTCMonth(d.getUTCMonth() + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Saturday on/before the given date (Saudi work week starts Saturday). */
function weekStartSat(dateStr: string): string {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  const offset = (dow + 1) % 7; // days since Saturday
  return addDays(dateStr, -offset);
}

function daysInMonth(ym: string): number {
  const d = ymToDate(ym);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Day-of-week for the 1st of the month, remapped so Saturday = 0 (Saudi work week). */
function firstDaySatOffset(ym: string): number {
  return (ymToDate(ym).getUTCDay() + 1) % 7;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
const WEEK_RANGE_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const DAY_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

interface LeadRef {
  client_name: string;
  client_phone: string | null;
}

interface FollowupRow {
  id: string;
  lead_id: string;
  follow_up_date: string;
  note: string | null;
  logged_by: string | null;
  completed_at: string | null;
  lead: LeadRef | LeadRef[] | null;
}

function leadRef(f: FollowupRow): LeadRef | null {
  return Array.isArray(f.lead) ? (f.lead[0] ?? null) : f.lead;
}

async function fetchEntriesByDay(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  start: string,
  end: string
): Promise<Record<string, FollowupChip[]>> {
  const { data } = await admin
    .from("lead_followups")
    .select("id, lead_id, follow_up_date, note, logged_by, completed_at, lead:leads(client_name, client_phone)")
    .eq("user_id", userId)
    .gte("follow_up_date", start)
    .lte("follow_up_date", end)
    .order("follow_up_date", { ascending: true });

  const entriesByDay: Record<string, FollowupChip[]> = {};
  for (const r of (data ?? []) as FollowupRow[]) {
    if (!YMD_RE.test(r.follow_up_date)) continue;
    const lead = leadRef(r);
    const chip: FollowupChip = {
      id: r.id,
      lead_id: r.lead_id,
      lead_name: lead?.client_name ?? "Unknown lead",
      lead_phone: lead?.client_phone ?? null,
      follow_up_date: r.follow_up_date,
      note: r.note,
      logged_by: r.logged_by,
      completed_at: r.completed_at,
    };
    (entriesByDay[r.follow_up_date] ??= []).push(chip);
  }
  return entriesByDay;
}

type FollowupView = "month" | "week" | "day";

interface PageProps {
  searchParams: Promise<{ month?: string; view?: string; date?: string }>;
}

export default async function FollowupsCalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const today = todayYmd();
  const view: FollowupView = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = sp.date && YMD_RE.test(sp.date) ? sp.date : today;
  const month = sp.month && YM_RE.test(sp.month) ? sp.month : date.slice(0, 7);

  const admin = createAdminClient();
  const tenantId = getTenantId();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          Back to leads
        </Link>
        <FollowupsViewToggle active={view} anchorDate={date} />
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Follow-ups
        </h1>

        {view === "month" && (
          <MonthNav month={month} />
        )}
        {view === "week" && <WeekNav date={date} />}
        {view === "day" && <DayNav date={date} today={today} />}
      </div>

      {view === "month" && <MonthView month={month} today={today} admin={admin} userId={tenantId} />}
      {view === "week" && <WeekView date={date} today={today} admin={admin} userId={tenantId} />}
      {view === "day" && <DayView date={date} admin={admin} userId={tenantId} />}
    </div>
  );
}

function MonthNav({ month }: { month: string }) {
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  return (
    <div className="flex items-center gap-2">
      {month !== todayYm() && (
        <Link href="/leads/followups?view=month" className="text-xs font-semibold text-primary hover:text-primary-hover mr-1">
          This month
        </Link>
      )}
      <Link
        href={`/leads/followups?view=month&month=${prevMonth}`}
        className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
        aria-label="Previous month"
      >
        <ChevronLeft size={16} strokeWidth={1.8} />
      </Link>
      <span className="text-sm font-medium text-foreground w-40 text-center">{MONTH_FMT.format(ymToDate(month))}</span>
      <Link
        href={`/leads/followups?view=month&month=${nextMonth}`}
        className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
        aria-label="Next month"
      >
        <ChevronRight size={16} strokeWidth={1.8} />
      </Link>
    </div>
  );
}

function WeekNav({ date }: { date: string }) {
  const start = weekStartSat(date);
  const end = addDays(start, 6);
  const prevWeek = addDays(start, -7);
  const nextWeek = addDays(start, 7);
  const today = todayYmd();
  return (
    <div className="flex items-center gap-2">
      {weekStartSat(today) !== start && (
        <Link href="/leads/followups?view=week" className="text-xs font-semibold text-primary hover:text-primary-hover mr-1">
          This week
        </Link>
      )}
      <Link
        href={`/leads/followups?view=week&date=${prevWeek}`}
        className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
        aria-label="Previous week"
      >
        <ChevronLeft size={16} strokeWidth={1.8} />
      </Link>
      <span className="text-sm font-medium text-foreground w-40 text-center">
        {WEEK_RANGE_FMT.format(new Date(`${start}T00:00:00Z`))} – {WEEK_RANGE_FMT.format(new Date(`${end}T00:00:00Z`))}
      </span>
      <Link
        href={`/leads/followups?view=week&date=${nextWeek}`}
        className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
        aria-label="Next week"
      >
        <ChevronRight size={16} strokeWidth={1.8} />
      </Link>
    </div>
  );
}

function DayNav({ date, today }: { date: string; today: string }) {
  return (
    <div className="flex items-center gap-2">
      {date !== today && (
        <Link href="/leads/followups?view=day" className="text-xs font-semibold text-primary hover:text-primary-hover mr-1">
          Today
        </Link>
      )}
      <Link
        href={`/leads/followups?view=day&date=${addDays(date, -1)}`}
        className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
        aria-label="Previous day"
      >
        <ChevronLeft size={16} strokeWidth={1.8} />
      </Link>
      <span className="text-sm font-medium text-foreground w-48 text-center">
        {DAY_FMT.format(new Date(`${date}T00:00:00Z`))}
      </span>
      <Link
        href={`/leads/followups?view=day&date=${addDays(date, 1)}`}
        className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
        aria-label="Next day"
      >
        <ChevronRight size={16} strokeWidth={1.8} />
      </Link>
    </div>
  );
}

async function MonthView({
  month,
  today,
  admin,
  userId,
}: {
  month: string;
  today: string;
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
}) {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const entriesByDay = await fetchEntriesByDay(admin, userId, monthStart, monthEnd);

  const leadingBlanks = firstDaySatOffset(month);
  const totalDays = daysInMonth(month);
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return <FollowupsCalendarGrid cells={cells} month={month} today={today} entriesByDay={entriesByDay} />;
}

async function WeekView({
  date,
  today,
  admin,
  userId,
}: {
  date: string;
  today: string;
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
}) {
  const start = weekStartSat(date);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const entriesByDay = await fetchEntriesByDay(admin, userId, start, end);

  return <FollowupsWeekStrip days={days} today={today} entriesByDay={entriesByDay} />;
}

async function DayView({
  date,
  admin,
  userId,
}: {
  date: string;
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
}) {
  const entriesByDay = await fetchEntriesByDay(admin, userId, date, date);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{DAY_FMT.format(new Date(`${date}T00:00:00Z`))}</CardTitle>
      </CardHeader>
      <DayFollowupsPanel date={date} entries={entriesByDay[date] ?? []} showAddForm={false} />
    </Card>
  );
}
