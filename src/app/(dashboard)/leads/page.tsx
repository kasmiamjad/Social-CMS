export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadsTable, type LeadRow } from "@/components/leads/leads-table";
import { buildChatInfo, uniqueConversationIds } from "@/lib/chat-info";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Plus } from "lucide-react";

/** Lead sources created by the AI bot rather than a person. */
const BOT_SOURCES = new Set(["whatsapp_ai", "facebook", "instagram", "youtube"]);

/** Statuses still in the open pipeline — the only ones shown on the Leads list.
 * Scheduled/installed/in-service move to Bookings; won/lost drop out of the list. */
const OPEN_STATUSES = new Set(["new", "contacted", "qualified", "quoted"]);

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Leads</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to view leads.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  // The account owner's name, used as the "Added by" label for manual leads.
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null }>();
  const ownerName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "Team";

  const { data } = await admin
    .from("leads")
    .select(
      "id, serial_no, client_code, client_name, client_phone, client_business_type, product_qty, product_model, installation_date, next_service_date, scope, installed_by, location_address, location_url, status, source, remarks, created_at, whatsapp_conversation_id, messenger_conversation_id, instagram_conversation_id"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const rawLeads = (data ?? []) as Array<
    LeadRow & {
      whatsapp_conversation_id: string | null;
      messenger_conversation_id: string | null;
      instagram_conversation_id: string | null;
    }
  >;

  // Pull last-customer-message + total chat count for leads linked to a chat.
  const waIds = uniqueConversationIds(rawLeads.map((l) => l.whatsapp_conversation_id));
  const msgrIds = uniqueConversationIds(rawLeads.map((l) => l.messenger_conversation_id));
  const igIds = uniqueConversationIds(rawLeads.map((l) => l.instagram_conversation_id));
  const [waChat, msgrChat, igChat] = await Promise.all([
    buildChatInfo(admin, "whatsapp_messages", waIds),
    buildChatInfo(admin, "messenger_messages", msgrIds),
    buildChatInfo(admin, "instagram_dm_messages", igIds),
  ]);

  const leads: LeadRow[] = rawLeads.map((l) => {
    const chat = l.whatsapp_conversation_id
      ? waChat.get(l.whatsapp_conversation_id)
      : l.messenger_conversation_id
        ? msgrChat.get(l.messenger_conversation_id)
        : l.instagram_conversation_id
          ? igChat.get(l.instagram_conversation_id)
          : undefined;
    return {
      ...l,
      last_customer_msg: chat?.lastCustomerMsg ?? null,
      chat_count: chat?.count ?? 0,
      chat_channel: l.whatsapp_conversation_id
        ? ("whatsapp" as const)
        : l.messenger_conversation_id
          ? ("messenger" as const)
          : l.instagram_conversation_id
            ? ("instagram" as const)
            : null,
      chat_conversation_id:
        l.whatsapp_conversation_id ?? l.messenger_conversation_id ?? l.instagram_conversation_id ?? null,
      added_by: BOT_SOURCES.has(l.source) ? "AI Bot" : ownerName,
    };
  });

  // Only open-pipeline leads appear in the list; the rest live on Bookings or
  // are closed. Stats below are still computed from the full set.
  const openLeads = leads.filter((l) => OPEN_STATUSES.has(l.status));

  // Stats
  const total = leads.length;
  const won = leads.filter((l) => ["won", "scheduled", "installed", "in_service"].includes(l.status)).length;
  const open = leads.filter((l) => ["new", "contacted", "qualified", "quoted"].includes(l.status)).length;
  const fromWhatsApp = leads.filter((l) => l.source === "whatsapp_ai").length;

  return (
    <div>
      {/* Realtime push — new leads/messages refresh the list instantly */}
      <RealtimeRefresh tables={["leads", "whatsapp_messages", "messenger_messages", "instagram_dm_messages"]} />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
            Leads
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Active leads (new → quoted). Scheduled ones move to Bookings.
          </p>
        </div>
        <Link
          href="/leads/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
        >
          <Plus size={14} strokeWidth={2} />
          New Lead
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={total} />
        <StatCard label="Open" value={open} hint="new / contacted / qualified / quoted" />
        <StatCard label="Won" value={won} hint="won / installed / in service" />
        <StatCard label="From WhatsApp" value={fromWhatsApp} />
      </div>

      <LeadsTable leads={openLeads} />
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
      {hint && <div className="text-[10px] text-text-muted mt-1">{hint}</div>}
    </div>
  );
}

