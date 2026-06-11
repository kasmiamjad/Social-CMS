import Link from "next/link";
import {
  Users,
  MessageCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";

interface EngagementStatsProps {
  totalLeads: number;
  openLeads: number;
  wonLeads: number;
  whatsappConversations: number;
  unrepliedMessages: number;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: typeof Users;
  tint: "primary" | "warning" | "success" | "muted";
  href?: string;
  sublabel?: string;
}

const TINT_CLASSES: Record<StatCardProps["tint"], string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  muted: "bg-surface text-text-muted",
};

function StatCard({ label, value, icon: Icon, tint, href, sublabel }: StatCardProps) {
  const content = (
    <div className="rounded-xl border border-border bg-surface-elevated p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            {label}
          </div>
          <div className="text-3xl font-bold text-foreground mt-1.5 font-[family-name:var(--font-heading)]">
            {value}
          </div>
          {sublabel && (
            <div className="text-[11px] text-text-muted mt-1">{sublabel}</div>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${TINT_CLASSES[tint]}`}
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export function EngagementStatsCards({
  totalLeads,
  openLeads,
  wonLeads,
  whatsappConversations,
  unrepliedMessages,
}: EngagementStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Leads"
        value={totalLeads}
        icon={Users}
        tint="primary"
        href="/leads"
        sublabel="All time"
      />
      <StatCard
        label="Open Leads"
        value={openLeads}
        icon={Clock}
        tint="warning"
        href="/leads"
        sublabel="new / contacted / qualified"
      />
      <StatCard
        label="Won / Installed"
        value={wonLeads}
        icon={CheckCircle2}
        tint="success"
        href="/leads"
        sublabel="Closed deals"
      />
      <StatCard
        label="WhatsApp Conversations"
        value={whatsappConversations}
        icon={MessageCircle}
        tint="primary"
        href="/whatsapp"
        sublabel={
          unrepliedMessages > 0
            ? `${unrepliedMessages} need attention`
            : "All caught up"
        }
      />
    </div>
  );
}

// Conversion rate widget reused below the cards
export function ConversionRateCard({
  totalLeads,
  wonLeads,
}: {
  totalLeads: number;
  wonLeads: number;
}) {
  const rate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
          <TrendingUp size={20} strokeWidth={1.8} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            Conversion rate
          </div>
          <div className="text-2xl font-bold text-foreground mt-0.5 font-[family-name:var(--font-heading)]">
            {rate}%
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {wonLeads} won out of {totalLeads} total leads
          </div>
        </div>
      </div>
    </div>
  );
}
