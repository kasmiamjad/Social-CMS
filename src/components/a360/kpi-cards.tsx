import { Card } from "@/components/ui/card";
import { Users, Clock, CheckCircle2, Award } from "lucide-react";
import { A360_ACCENT, A360_ACCENT_ON } from "@/types/a360";

interface KpiCardsProps {
  totalLeads: number;
  followUpCount: number;
  convertedCount: number;
  topAgent: { agentName: string; conversionRatePct: number } | null;
}

export function KpiCards({ totalLeads, followUpCount, convertedCount, topAgent }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${A360_ACCENT}1A` }}
          >
            <Users size={18} strokeWidth={1.8} style={{ color: A360_ACCENT }} />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
              {totalLeads}
            </p>
            <p className="text-xs text-text-muted">Total Leads</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${A360_ACCENT}1A` }}
          >
            <Clock size={18} strokeWidth={1.8} style={{ color: A360_ACCENT }} />
          </div>
          <div>
            <p
              className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)]"
              style={{ color: A360_ACCENT }}
            >
              {followUpCount}
            </p>
            <p className="text-xs text-text-muted">Open Follow-ups</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${A360_ACCENT}1A` }}
          >
            <CheckCircle2 size={18} strokeWidth={1.8} style={{ color: A360_ACCENT }} />
          </div>
          <div>
            <p
              className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)]"
              style={{ color: A360_ACCENT }}
            >
              {convertedCount}
            </p>
            <p className="text-xs text-text-muted">Converted Leads</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: A360_ACCENT }}
          >
            <Award size={18} strokeWidth={1.8} style={{ color: A360_ACCENT_ON }} />
          </div>
          <div>
            {topAgent ? (
              <p
                className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)]"
                style={{ color: A360_ACCENT }}
              >
                {topAgent.conversionRatePct.toFixed(1)}%
              </p>
            ) : (
              <p className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-text-muted">—</p>
            )}
            <p className="text-xs text-text-muted">Top Agent: {topAgent?.agentName ?? "—"}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
