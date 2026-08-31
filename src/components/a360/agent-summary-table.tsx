import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";
import type { A360AgentSummary } from "@/types/a360";

interface AgentSummaryTableProps {
  agents: A360AgentSummary[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export function AgentSummaryTable({ agents }: AgentSummaryTableProps) {
  return (
    <Card padding={false}>
      <div className="flex items-center gap-2 p-6 pb-4">
        <Users size={16} strokeWidth={1.8} className="text-primary" />
        <h3 className="text-base font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Sales Agent Conversion Summary
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-b border-border text-[10px] uppercase tracking-wider text-text-muted">
              <th className="text-left font-medium px-6 py-3">Sales Agent</th>
              <th className="text-right font-medium px-4 py-3">Total Assigned</th>
              <th className="text-right font-medium px-4 py-3">Follow-up Queue</th>
              <th className="text-right font-medium px-4 py-3">Link Sent</th>
              <th className="text-right font-medium px-4 py-3">Converted</th>
              <th className="text-right font-medium px-4 py-3">Not Interested</th>
              <th className="text-right font-medium px-6 py-3">Conversion Rate %</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-text-muted py-8">
                  No leads yet.
                </td>
              </tr>
            )}
            {agents.map((a) => (
              <tr key={a.agentName} className="border-b border-border last:border-0">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {initials(a.agentName)}
                    </span>
                    <span className="text-foreground font-medium">{a.agentName}</span>
                  </div>
                </td>
                <td className="text-right px-4 py-3 text-foreground">{a.totalAssigned}</td>
                <td className="text-right px-4 py-3 text-warning">{a.followUpQueue}</td>
                <td className="text-right px-4 py-3 text-sky-400">{a.linkSent}</td>
                <td className="text-right px-4 py-3 text-success font-semibold">{a.converted}</td>
                <td className="text-right px-4 py-3 text-error">{a.notInterested}</td>
                <td className="text-right px-6 py-3 text-success font-semibold">{a.conversionRatePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
