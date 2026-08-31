import { A360_STATUS_VALUES, toA360Status } from "@/types/a360";
import type { A360AgentSummary, A360LeadRow, A360StatusShare, A360TrendPoint } from "@/types/a360";

export function computeStatusShares(leads: A360LeadRow[]): A360StatusShare[] {
  const total = leads.length;
  const counts = new Map<string, number>(A360_STATUS_VALUES.map((s) => [s, 0]));
  for (const lead of leads) {
    const status = toA360Status(lead.call_status);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return A360_STATUS_VALUES.map((status) => {
    const count = counts.get(status) ?? 0;
    return { status, count, sharePct: total > 0 ? (count / total) * 100 : 0 };
  });
}

export function computeDailyTrend(leads: A360LeadRow[]): A360TrendPoint[] {
  const byDate = new Map<string, A360TrendPoint>();
  for (const lead of leads) {
    const date = lead.created_at.slice(0, 10);
    let point = byDate.get(date);
    if (!point) {
      point = {
        date,
        total: 0,
        unread: 0,
        read: 0,
        follow_up: 0,
        unanswered: 0,
        not_interested: 0,
        link_send: 0,
        converted: 0,
      };
      byDate.set(date, point);
    }
    const status = toA360Status(lead.call_status);
    point[status] += 1;
    point.total += 1;
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function computeAgentSummary(leads: A360LeadRow[]): A360AgentSummary[] {
  const byAgent = new Map<string, A360AgentSummary>();
  for (const lead of leads) {
    const agentName = lead.assigned_to?.trim() || "Unassigned";
    let summary = byAgent.get(agentName);
    if (!summary) {
      summary = {
        agentName,
        totalAssigned: 0,
        followUpQueue: 0,
        linkSent: 0,
        converted: 0,
        notInterested: 0,
        conversionRatePct: 0,
      };
      byAgent.set(agentName, summary);
    }
    summary.totalAssigned += 1;
    const status = toA360Status(lead.call_status);
    if (status === "follow_up") summary.followUpQueue += 1;
    if (status === "link_send") summary.linkSent += 1;
    if (status === "converted") summary.converted += 1;
    if (status === "not_interested") summary.notInterested += 1;
  }
  const summaries = Array.from(byAgent.values());
  for (const s of summaries) {
    s.conversionRatePct = s.totalAssigned > 0 ? (s.converted / s.totalAssigned) * 100 : 0;
  }
  return summaries.sort((a, b) => b.totalAssigned - a.totalAssigned);
}

export function computeTopLocation(leads: A360LeadRow[]): { city: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const city = lead.city?.trim();
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  let top: { city: string; count: number } | null = null;
  for (const [city, count] of counts) {
    if (!top || count > top.count) top = { city, count };
  }
  return top;
}

/** Highest conversion rate among agents with at least one assigned lead. */
export function computeTopAgent(agentSummaries: A360AgentSummary[]): A360AgentSummary | null {
  const withVolume = agentSummaries.filter((a) => a.totalAssigned > 0 && a.agentName !== "Unassigned");
  if (withVolume.length === 0) return null;
  return withVolume.reduce((best, current) =>
    current.conversionRatePct > best.conversionRatePct ? current : best
  );
}
