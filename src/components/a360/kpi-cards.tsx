import { Card } from "@/components/ui/card";
import { Users, Clock, CheckCircle2 } from "lucide-react";
import { A360_ACCENT } from "@/types/a360";

interface KpiCardsProps {
  totalLeads: number;
  followUpCount: number;
  convertedCount: number;
}

export function KpiCards({ totalLeads, followUpCount, convertedCount }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <p className="text-xs text-text-muted mt-3">
          {totalLeads} Leads <span style={{ color: A360_ACCENT }}>Across All Statuses</span>
        </p>
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
        <p className="text-xs text-text-muted mt-3">
          {followUpCount} Leads <span style={{ color: A360_ACCENT }}>Awaiting a Call Back</span>
        </p>
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
        <p className="text-xs text-text-muted mt-3">
          {convertedCount} Leads <span style={{ color: A360_ACCENT }}>Successfully Closed</span>
        </p>
      </Card>
    </div>
  );
}
