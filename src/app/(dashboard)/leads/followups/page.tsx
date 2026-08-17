export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

function daysInMonth(ym: string): number {
  const d = ymToDate(ym);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Day-of-week for the 1st of the month, remapped so Saturday = 0 (Saudi work week). */
function firstDaySatOffset(ym: string): number {
  return (ymToDate(ym).getUTCDay() + 1) % 7;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
const WEEKDAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

interface FollowupEntry {
  id: string;
  lead_id: string;
  follow_up_date: string;
  note: string | null;
  logged_by: string | null;
  lead: { client_name: string } | { client_name: string }[] | null;
}

function leadName(f: FollowupEntry): string {
  const lead = Array.isArray(f.lead) ? f.lead[0] : f.lead;
  return lead?.client_name ?? "Unknown lead";
}

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function FollowupsCalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const month = sp.month && YM_RE.test(sp.month) ? sp.month : todayYm();
  const today = todayYmd();

  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

  const admin = createAdminClient();
  const { data } = await admin
    .from("lead_followups")
    .select("id, lead_id, follow_up_date, note, logged_by, lead:leads(client_name)")
    .eq("user_id", user.id)
    .gte("follow_up_date", monthStart)
    .lte("follow_up_date", monthEnd)
    .order("follow_up_date", { ascending: true });

  const entries = (data ?? []) as FollowupEntry[];
  const byDay = new Map<string, FollowupEntry[]>();
  for (const e of entries) {
    if (!YMD_RE.test(e.follow_up_date)) continue;
    const bucket = byDay.get(e.follow_up_date);
    if (bucket) bucket.push(e);
    else byDay.set(e.follow_up_date, [e]);
  }

  const leadingBlanks = firstDaySatOffset(month);
  const totalDays = daysInMonth(month);
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to a full last week so the grid always has complete rows.
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

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
        {month !== todayYm() && (
          <Link href="/leads/followups" className="text-xs font-semibold text-primary hover:text-primary-hover">
            This month
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Follow-ups
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/leads/followups?month=${prevMonth}`}
            className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} strokeWidth={1.8} />
          </Link>
          <span className="text-sm font-medium text-foreground w-40 text-center">
            {MONTH_FMT.format(ymToDate(month))}
          </span>
          <Link
            href={`/leads/followups?month=${nextMonth}`}
            className="p-2 rounded-lg border border-border text-foreground hover:bg-surface"
            aria-label="Next month"
          >
            <ChevronRight size={16} strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px] rounded-xl border border-border bg-surface-elevated overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={i} className="min-h-[110px] border-b border-r border-border last:border-r-0" />;
              }
              const dateStr = `${month}-${String(day).padStart(2, "0")}`;
              const dayEntries = byDay.get(dateStr) ?? [];
              const isToday = dateStr === today;
              const isOverdue = dateStr < today && dayEntries.length > 0;
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
                    {shown.map((e) => (
                      <Link
                        key={e.id}
                        href={`/leads/${e.lead_id}`}
                        title={e.note ?? undefined}
                        className={`block truncate text-[11px] px-1.5 py-0.5 rounded ${
                          isOverdue
                            ? "bg-error/10 text-error hover:bg-error/20"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                      >
                        {leadName(e)}
                      </Link>
                    ))}
                    {extra > 0 && (
                      <div className="text-[10px] text-text-muted px-1.5">+{extra} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
