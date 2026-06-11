export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EngagementStatsCards,
  ConversionRateCard,
} from "@/components/dashboard/engagement-stats-cards";
import { RecentLeads, type RecentLeadRow } from "@/components/dashboard/recent-leads";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageCircle, Users, ArrowRight, Phone } from "lucide-react";

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

  // Parallel fetch — leads stats + WhatsApp stats + recent rows
  const [leadsStats, recentLeadsRes, whatsappRes, unrepliedRes] = await Promise.all([
    admin
      .from("leads")
      .select("status", { count: "exact" })
      .eq("user_id", user.id),
    admin
      .from("leads")
      .select(
        "id, serial_no, client_name, client_phone, client_business_type, product_model, status, source, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("whatsapp_conversations")
      .select("id, contact_phone, contact_name, last_message_preview, last_message_at, ai_paused, unread_count")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(5),
    admin
      .from("whatsapp_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("unread_count", 0),
  ]);

  const allLeads = leadsStats.data ?? [];
  const totalLeads = allLeads.length;
  const openLeads = allLeads.filter((l) =>
    ["new", "contacted", "qualified", "quoted"].includes(l.status as string)
  ).length;
  const wonLeads = allLeads.filter((l) =>
    ["won", "installed", "in_service"].includes(l.status as string)
  ).length;

  const recentLeads = (recentLeadsRes.data ?? []) as RecentLeadRow[];
  const whatsappConvs = whatsappRes.data ?? [];
  const unrepliedMessages = unrepliedRes.count ?? 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Your leads + WhatsApp activity at a glance
        </p>
      </div>

      <EngagementStatsCards
        totalLeads={totalLeads}
        openLeads={openLeads}
        wonLeads={wonLeads}
        whatsappConversations={whatsappConvs.length}
        unrepliedMessages={unrepliedMessages}
      />

      <div className="mt-6">
        <ConversionRateCard totalLeads={totalLeads} wonLeads={wonLeads} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentLeads leads={recentLeads} />
        </div>
        <div className="space-y-6">
          <RecentWhatsAppCard conversations={whatsappConvs} />
          <QuickActionsCard />
        </div>
      </div>
    </div>
  );
}

interface ConvRow {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  ai_paused: boolean;
  unread_count: number;
}

function RecentWhatsAppCard({ conversations }: { conversations: ConvRow[] }) {
  return (
    <Card padding={false}>
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <CardTitle>Recent WhatsApp</CardTitle>
          <CardDescription>Latest customer chats</CardDescription>
        </div>
        <Link
          href="/whatsapp"
          className="text-xs text-primary hover:text-primary-hover font-medium"
        >
          View all →
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-surface flex items-center justify-center mb-2">
            <Phone size={18} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <p className="text-xs text-text-muted">No conversations yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/whatsapp/conversations/${c.id}`}
                className="block px-5 py-3 hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-foreground truncate flex-1">
                    {c.contact_name?.trim() || c.contact_phone}
                  </div>
                  {c.ai_paused && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">
                      AI paused
                    </span>
                  )}
                  {c.unread_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                {c.last_message_preview && (
                  <div className="text-xs text-text-muted truncate mt-0.5">
                    {c.last_message_preview}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <div className="space-y-2">
        <Link
          href="/leads/new"
          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-surface group transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users size={15} strokeWidth={1.8} />
            </div>
            <div className="text-sm font-medium text-foreground">Add lead manually</div>
          </div>
          <ArrowRight size={14} strokeWidth={1.8} className="text-text-muted group-hover:text-foreground" />
        </Link>
        <Link
          href="/whatsapp"
          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-surface group transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle size={15} strokeWidth={1.8} />
            </div>
            <div className="text-sm font-medium text-foreground">WhatsApp inbox</div>
          </div>
          <ArrowRight size={14} strokeWidth={1.8} className="text-text-muted group-hover:text-foreground" />
        </Link>
      </div>
    </Card>
  );
}
