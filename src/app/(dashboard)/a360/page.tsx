export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import { KpiCards } from "@/components/a360/kpi-cards";
import { StatusDonut } from "@/components/a360/status-donut";
import { TopCards } from "@/components/a360/top-cards";
import { DailyTrendChart } from "@/components/a360/daily-trend-chart";
import { AgentSummaryTable } from "@/components/a360/agent-summary-table";
import { ChannelsCard } from "@/components/dashboard/channels-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { PeriodFilter } from "@/components/a360/period-filter";
import { TableFilters } from "@/components/ui/table-filters";
import { LeadListDetail } from "@/components/a360/lead-list-detail";
import { DayFollowupsPanel, type FollowupChip } from "@/components/leads/day-followups-panel";
import { RecentLeads, type RecentLeadRow } from "@/components/dashboard/recent-leads";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buildFollowupInfo } from "@/lib/followup-info";
import {
  computeStatusShares,
  computeDailyTrend,
  computeAgentSummary,
  computeLocationBreakdown,
  computeTopAgent,
} from "@/services/a360-dashboard.service";
import { toA360Status, A360_STATUS_LABELS, A360_ACCENT } from "@/types/a360";
import type { A360LeadRow } from "@/types/a360";

interface FollowupLeadRef {
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
  lead: FollowupLeadRef | FollowupLeadRef[] | null;
}

function leadRef(f: FollowupRow): FollowupLeadRef | null {
  return Array.isArray(f.lead) ? (f.lead[0] ?? null) : f.lead;
}

const SELECT_COLS = "id, client_name, client_phone, city, assigned_to, call_status, remarks, internal_notes, created_at";

// Flip to false to hide the search/filters + lead list & detail panel section again.
const SHOW_LEAD_LIST = true;

interface A360PageProps {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    agent?: string;
    status?: string;
    city?: string;
    q?: string;
  }>;
}

function startDateForPeriod(period: string): string | null {
  const now = new Date();
  if (period === "1d") return new Date(now.getTime() - 1 * 86400000).toISOString();
  if (period === "7d") return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (period === "30d") return new Date(now.getTime() - 30 * 86400000).toISOString();
  return null;
}

/** UTC-anchored, matches todayYmd() in leads/followups/page.tsx — follow_up_date is a plain DATE column. */
function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

const TODAY_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

export default async function A360Page({ searchParams }: A360PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">A360 Dashboard</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to view this dashboard.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const tenantId = getTenantId();
  const sp = await searchParams;
  const period = sp.period ?? "all";

  // ── Period-filtered leads (drives the KPI cards, donut, trend, agent table) ──
  let periodQuery = admin.from("leads").select(SELECT_COLS).eq("user_id", tenantId);
  if (period === "custom") {
    if (sp.from) periodQuery = periodQuery.gte("created_at", sp.from);
    if (sp.to) periodQuery = periodQuery.lte("created_at", `${sp.to}T23:59:59`);
  } else {
    const start = startDateForPeriod(period);
    if (start) periodQuery = periodQuery.gte("created_at", start);
  }
  const { data: periodData } = await periodQuery.order("created_at", { ascending: false });
  const rawPeriodLeads = (periodData ?? []) as Omit<A360LeadRow, "next_followup_date">[];

  const followupInfo = await buildFollowupInfo(admin, rawPeriodLeads.map((l) => l.id));
  const periodLeads: A360LeadRow[] = rawPeriodLeads.map((l) => ({
    ...l,
    next_followup_date: followupInfo.get(l.id)?.date ?? null,
  }));

  // ── Recent leads, same shape/query as the main Dashboard's Recent Leads —
  // enough rows to roughly match the right column's height (Top Location + Channels + Quick Actions stacked). ──
  const { data: recentLeadsData } = await admin
    .from("leads")
    .select("id, serial_no, client_name, client_phone, client_business_type, product_model, status, source, created_at")
    .eq("user_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(7);
  const recentLeads = (recentLeadsData ?? []) as RecentLeadRow[];

  // ── Today's follow-ups (same source/shape as leads/followups' Day view) ──
  const today = todayYmd();
  const { data: todayFollowupData } = await admin
    .from("lead_followups")
    .select("id, lead_id, follow_up_date, note, logged_by, completed_at, lead:leads(client_name, client_phone)")
    .eq("user_id", tenantId)
    .eq("follow_up_date", today)
    .order("created_at", { ascending: false });
  const todayFollowups: FollowupChip[] = ((todayFollowupData ?? []) as FollowupRow[]).map((r) => {
    const lead = leadRef(r);
    return {
      id: r.id,
      lead_id: r.lead_id,
      lead_name: lead?.client_name ?? "Unknown lead",
      lead_phone: lead?.client_phone ?? null,
      follow_up_date: r.follow_up_date,
      note: r.note,
      logged_by: r.logged_by,
      completed_at: r.completed_at,
    };
  });

  // ── Overdue follow-ups: still-pending entries dated before today ──
  const { data: overdueFollowupData } = await admin
    .from("lead_followups")
    .select("id, lead_id, follow_up_date, note, logged_by, completed_at, lead:leads(client_name, client_phone)")
    .eq("user_id", tenantId)
    .lt("follow_up_date", today)
    .is("completed_at", null)
    .order("follow_up_date", { ascending: true });
  const overdueFollowups: FollowupChip[] = ((overdueFollowupData ?? []) as FollowupRow[]).map((r) => {
    const lead = leadRef(r);
    return {
      id: r.id,
      lead_id: r.lead_id,
      lead_name: lead?.client_name ?? "Unknown lead",
      lead_phone: lead?.client_phone ?? null,
      follow_up_date: r.follow_up_date,
      note: r.note,
      logged_by: r.logged_by,
      completed_at: r.completed_at,
    };
  });

  // ── Channel conversation counts (same source as the main Dashboard's Channels card) ──
  const [waRes, msgrRes, igRes] = await Promise.all([
    admin.from("whatsapp_conversations").select("id", { count: "exact", head: true }).eq("user_id", tenantId),
    admin.from("messenger_conversations").select("id", { count: "exact", head: true }).eq("user_id", tenantId),
    admin.from("instagram_dm_conversations").select("id", { count: "exact", head: true }).eq("user_id", tenantId),
  ]);
  const waCount = waRes.count ?? 0;
  const msgrCount = msgrRes.count ?? 0;
  const igCount = igRes.count ?? 0;
  const totalConvs = waCount + msgrCount + igCount;

  // ── Aggregates (always over the full period-filtered set, independent of the drill-down filters below) ──
  const statusShares = computeStatusShares(periodLeads);
  const trendPoints = computeDailyTrend(periodLeads);
  const agentSummary = computeAgentSummary(periodLeads);
  const locationBreakdown = computeLocationBreakdown(periodLeads);
  const topAgent = computeTopAgent(agentSummary);

  const totalLeads = periodLeads.length;
  const followUpCount = statusShares.find((s) => s.status === "follow_up")?.count ?? 0;
  const convertedCount = statusShares.find((s) => s.status === "converted")?.count ?? 0;

  // ── Drill-down filters for the lead list (agent / status / city / search) ──
  const agentOptions = Array.from(new Set(periodLeads.map((l) => l.assigned_to?.trim()).filter(Boolean))).sort();
  const cityOptions = Array.from(new Set(periodLeads.map((l) => l.city?.trim()).filter(Boolean))).sort();

  const q = (sp.q ?? "").trim().toLowerCase();
  const filteredLeads = periodLeads.filter((lead) => {
    if (sp.agent && (lead.assigned_to?.trim() || "Unassigned") !== sp.agent) return false;
    if (sp.status && toA360Status(lead.call_status) !== sp.status) return false;
    if (sp.city && lead.city?.trim() !== sp.city) return false;
    if (q) {
      const haystack = `${lead.client_name} ${lead.client_phone ?? ""} ${lead.remarks ?? ""} ${lead.internal_notes ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
            A360 Dashboard
          </h1>
          <p className="text-sm text-text-muted mt-1">Lead conversion &amp; agent performance overview.</p>
        </div>
        <PeriodFilter />
      </div>

      <KpiCards
        totalLeads={totalLeads}
        followUpCount={followUpCount}
        convertedCount={convertedCount}
        topAgent={topAgent ? { agentName: topAgent.agentName, conversionRatePct: topAgent.conversionRatePct } : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        <div className="space-y-4">
          <StatusDonut shares={statusShares} totalLeads={totalLeads} />
          <RecentLeads leads={recentLeads} />
        </div>
        <div className="space-y-4">
          <TopCards locationBreakdown={locationBreakdown} />
          <ChannelsCard
            whatsapp={waCount}
            messenger={msgrCount}
            instagram={igCount}
            total={totalConvs}
            countColor={A360_ACCENT}
          />
          <QuickActionsCard />
        </div>
      </div>

      <DailyTrendChart points={trendPoints} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-start justify-between gap-4 flex-row">
            <div>
              <CardTitle>Today&apos;s Follow-ups</CardTitle>
              <CardDescription>{TODAY_FMT.format(new Date(`${today}T00:00:00Z`))}</CardDescription>
            </div>
            <Link href="/leads/followups" className="text-xs font-semibold text-primary hover:text-primary-hover shrink-0">
              View calendar
            </Link>
          </CardHeader>
          <DayFollowupsPanel date={today} entries={todayFollowups} showAddForm={false} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-error">Overdue Follow-ups</CardTitle>
            <CardDescription>Still pending, dated before today</CardDescription>
          </CardHeader>
          <DayFollowupsPanel date={today} entries={overdueFollowups} showAddForm={false} showEntryDates />
        </Card>
      </div>

      <AgentSummaryTable agents={agentSummary} />

      {/* Hidden for now per request — code kept intact, same "hidden" convention as
          sidebar.tsx's navItems, so this can come back with a one-line flip. */}
      {SHOW_LEAD_LIST && (
        <div>
          <TableFilters
            searchPlaceholder="Search name, phone, or notes…"
            selects={[
              {
                param: "agent",
                ariaLabel: "Agent",
                options: [
                  { value: "", label: `All Agents (${totalLeads})` },
                  ...agentOptions.map((a) => ({ value: a as string, label: a as string })),
                ],
              },
              {
                param: "status",
                ariaLabel: "Status",
                options: [
                  { value: "", label: "All Statuses" },
                  ...statusShares.map((s) => ({ value: s.status, label: A360_STATUS_LABELS[s.status] })),
                ],
              },
              {
                param: "city",
                ariaLabel: "Location",
                options: [
                  { value: "", label: "All Locations" },
                  ...cityOptions.map((c) => ({ value: c as string, label: c as string })),
                ],
              },
            ]}
          />
          <LeadListDetail leads={filteredLeads} />
        </div>
      )}
    </div>
  );
}
