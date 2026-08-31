export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import { RecentLeads, type RecentLeadRow } from "@/components/dashboard/recent-leads";
import { ChannelsCard, WHATSAPP, MESSENGER, INSTAGRAM } from "@/components/dashboard/channels-card";
import { WhatsAppIcon, MessengerIcon, InstagramIcon } from "@/components/icons/platform-icons";
import {
  Users,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Inbox,
  Plus,
  type LucideIcon,
} from "lucide-react";

type IconComponent = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const OPEN_STATUSES = ["new", "contacted", "qualified", "quoted"];
const WON_STATUSES = ["won", "installed", "in_service"];

interface RecentConv {
  key: string;
  channel: "whatsapp" | "messenger" | "instagram";
  name: string;
  preview: string | null;
  at: string | null;
  href: string;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to view your dashboard.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const tenantId = getTenantId();

  const [totalRes, openRes, wonRes, recentLeadsRes, waRes, msgrRes, igRes] = await Promise.all([
    admin.from("leads").select("id", { count: "exact", head: true }).eq("user_id", tenantId),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("user_id", tenantId).in("status", OPEN_STATUSES),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("user_id", tenantId).in("status", WON_STATUSES),
    admin
      .from("leads")
      .select("id, serial_no, client_name, client_phone, client_business_type, product_model, status, source, created_at")
      .eq("user_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(7),
    admin
      .from("whatsapp_conversations")
      .select("id, contact_name, contact_phone, last_message_preview, last_message_at", { count: "exact" })
      .eq("user_id", tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(6),
    admin
      .from("messenger_conversations")
      .select("id, contact_name, psid, last_message_preview, last_message_at", { count: "exact" })
      .eq("user_id", tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(6),
    admin
      .from("instagram_dm_conversations")
      .select("id, contact_name, contact_username, contact_ig_id, last_message_preview, last_message_at", { count: "exact" })
      .eq("user_id", tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(6),
  ]);

  const totalLeads = totalRes.count ?? 0;
  const openLeads = openRes.count ?? 0;
  const wonLeads = wonRes.count ?? 0;
  const conversion = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  const waCount = waRes.count ?? 0;
  const msgrCount = msgrRes.count ?? 0;
  const igCount = igRes.count ?? 0;
  const totalConvs = waCount + msgrCount + igCount;

  const recentLeads = (recentLeadsRes.data ?? []) as RecentLeadRow[];

  // Merge the newest chats from all three channels into one activity feed.
  type WaRow = { id: string; contact_name: string | null; contact_phone: string; last_message_preview: string | null; last_message_at: string | null };
  type MsgrRow = { id: string; contact_name: string | null; psid: string; last_message_preview: string | null; last_message_at: string | null };
  type IgRow = { id: string; contact_name: string | null; contact_username: string | null; contact_ig_id: string; last_message_preview: string | null; last_message_at: string | null };

  const recentConvs: RecentConv[] = [
    ...((waRes.data ?? []) as WaRow[]).map((c) => ({
      key: `wa-${c.id}`,
      channel: "whatsapp" as const,
      name: c.contact_name?.trim() || c.contact_phone,
      preview: c.last_message_preview,
      at: c.last_message_at,
      href: `/whatsapp/conversations/${c.id}`,
    })),
    ...((msgrRes.data ?? []) as MsgrRow[]).map((c) => ({
      key: `ms-${c.id}`,
      channel: "messenger" as const,
      name: c.contact_name?.trim() || `Messenger …${c.psid.slice(-6)}`,
      preview: c.last_message_preview,
      at: c.last_message_at,
      href: `/messenger`,
    })),
    ...((igRes.data ?? []) as IgRow[]).map((c) => ({
      key: `ig-${c.id}`,
      channel: "instagram" as const,
      name: c.contact_name?.trim() || (c.contact_username ? `@${c.contact_username}` : `Instagram …${c.contact_ig_id.slice(-6)}`),
      preview: c.last_message_preview,
      at: c.last_message_at,
      href: `/instagram`,
    })),
  ]
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, 6);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.6px] font-[family-name:var(--font-heading)] text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Your leads and messaging across WhatsApp, Messenger &amp; Instagram
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total leads" value={totalLeads} hint="All time" icon={Users} accent="var(--color-primary)" delay={0} />
        <Kpi label="Open leads" value={openLeads} hint="new · contacted · qualified" icon={Clock} accent="var(--warning)" delay={60} />
        <Kpi label="Won / installed" value={wonLeads} hint="closed deals" icon={CheckCircle2} accent="var(--success)" delay={120} />
        <Kpi label="Conversion" value={`${conversion}%`} hint={`${wonLeads} of ${totalLeads} leads`} icon={TrendingUp} accent="var(--color-primary)" delay={180} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: recent leads */}
        <div className="lg:col-span-2 animate-fade-up" style={{ animationDelay: "220ms" }}>
          <RecentLeads leads={recentLeads} />
        </div>

        {/* Right: channels + quick actions */}
        <div className="space-y-6">
          <ChannelsCard
            whatsapp={waCount}
            messenger={msgrCount}
            instagram={igCount}
            total={totalConvs}
          />
          <QuickActionsCard />
        </div>
      </div>

      {/* Activity feed */}
      <div className="mt-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
        <RecentActivity conversations={recentConvs} />
      </div>
    </div>
  );
}

/* ── KPI card with a soft accent glow ─────────────────────────────────────── */
function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  delay: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-20"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between">
        <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
      <div className="relative mt-3 text-3xl font-bold text-foreground font-[family-name:var(--font-heading)]">
        {value}
      </div>
      <div className="relative text-[11px] text-text-muted mt-1">{hint}</div>
    </div>
  );
}

/* ── Unified recent activity across channels ──────────────────────────────── */
function RecentActivity({ conversations }: { conversations: RecentConv[] }) {
  const meta: Record<RecentConv["channel"], { color: string; icon: IconComponent; label: string }> = {
    whatsapp: { color: WHATSAPP, icon: WhatsAppIcon, label: "WhatsApp" },
    messenger: { color: MESSENGER, icon: MessengerIcon, label: "Messenger" },
    instagram: { color: INSTAGRAM, icon: InstagramIcon, label: "Instagram" },
  };
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated">
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <h2 className="text-base font-bold text-foreground font-[family-name:var(--font-heading)]">Recent activity</h2>
          <p className="text-xs text-text-muted mt-0.5">Latest chats across every channel</p>
        </div>
      </div>
      {conversations.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-surface flex items-center justify-center mb-2">
            <Inbox size={18} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <p className="text-xs text-text-muted">No conversations yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {conversations.map((c) => {
            const m = meta[c.channel];
            return (
              <li key={c.key}>
                <Link href={c.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface transition-colors">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}
                  >
                    <m.icon size={16} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                      <span className="text-[10px] text-text-muted shrink-0">{m.label}</span>
                    </div>
                    {c.preview && <div className="text-xs text-text-muted truncate mt-0.5">{c.preview}</div>}
                  </div>
                  <span className="text-[11px] text-text-muted shrink-0">{timeAgo(c.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Quick actions ────────────────────────────────────────────────────────── */
function QuickActionsCard() {
  const actions: { label: string; href: string; icon: IconComponent; color: string }[] = [
    { label: "Add lead manually", href: "/leads/new", icon: Plus, color: "var(--color-primary)" },
    { label: "WhatsApp inbox", href: "/whatsapp", icon: WhatsAppIcon, color: WHATSAPP },
    { label: "Messenger inbox", href: "/messenger", icon: MessengerIcon, color: MESSENGER },
    { label: "Instagram inbox", href: "/instagram", icon: InstagramIcon, color: INSTAGRAM },
  ];
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-5 animate-fade-up" style={{ animationDelay: "200ms" }}>
      <h2 className="text-base font-bold text-foreground font-[family-name:var(--font-heading)] mb-3">Quick actions</h2>
      <div className="space-y-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border hover:bg-surface group transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color }}
              >
                <a.icon size={15} strokeWidth={1.8} />
              </div>
              <span className="text-sm font-medium text-foreground">{a.label}</span>
            </div>
            <ArrowRight size={14} strokeWidth={1.8} className="text-text-muted group-hover:text-foreground transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
