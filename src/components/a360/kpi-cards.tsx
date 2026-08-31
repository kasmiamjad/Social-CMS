import { Card } from "@/components/ui/card";
import { Users, Clock, Target, CheckCircle2 } from "lucide-react";

interface KpiCardsProps {
  totalLeads: number;
  followUpCount: number;
  convertedCount: number;
  conversionRatePct: number;
  targetPct?: number;
}

export function KpiCards({
  totalLeads,
  followUpCount,
  convertedCount,
  conversionRatePct,
  targetPct = 5,
}: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users size={18} strokeWidth={1.8} className="text-primary" />
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
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Clock size={18} strokeWidth={1.8} className="text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
              {followUpCount}
            </p>
            <p className="text-xs text-text-muted">Open Follow-ups</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <Target size={18} strokeWidth={1.8} className="text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
              {conversionRatePct.toFixed(1)}%
            </p>
            <p className="text-xs text-text-muted">Conversion Rate · Target {targetPct.toFixed(1)}%</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} strokeWidth={1.8} className="text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
              {convertedCount}
            </p>
            <p className="text-xs text-text-muted">Converted Leads</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
