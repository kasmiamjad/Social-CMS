export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadsTable, type LeadRow } from "@/components/leads/leads-table";
import { Plus } from "lucide-react";

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
  const { data } = await admin
    .from("leads")
    .select(
      "id, serial_no, client_code, client_name, client_phone, client_business_type, product_qty, product_model, installation_date, next_service_date, scope, installed_by, location_address, location_url, status, source, remarks, created_at, whatsapp_conversation_id, messenger_conversation_id"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const rawLeads = (data ?? []) as Array<
    LeadRow & {
      whatsapp_conversation_id: string | null;
      messenger_conversation_id: string | null;
    }
  >;

  // Pull last-customer-message + total chat count for leads linked to a chat.
  const waIds = unique(rawLeads.map((l) => l.whatsapp_conversation_id));
  const msgrIds = unique(rawLeads.map((l) => l.messenger_conversation_id));
  const [waChat, msgrChat] = await Promise.all([
    buildChatInfo(admin, "whatsapp_messages", waIds),
    buildChatInfo(admin, "messenger_messages", msgrIds),
  ]);

  const leads: LeadRow[] = rawLeads.map((l) => {
    const chat = l.whatsapp_conversation_id
      ? waChat.get(l.whatsapp_conversation_id)
      : l.messenger_conversation_id
        ? msgrChat.get(l.messenger_conversation_id)
        : undefined;
    return {
      ...l,
      last_customer_msg: chat?.lastCustomerMsg ?? null,
      chat_count: chat?.count ?? 0,
    };
  });

  // Stats
  const total = leads.length;
  const won = leads.filter((l) => ["won", "scheduled", "installed", "in_service"].includes(l.status)).length;
  const open = leads.filter((l) => ["new", "contacted", "qualified", "quoted"].includes(l.status)).length;
  const fromWhatsApp = leads.filter((l) => l.source === "whatsapp_ai").length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
            Leads
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage customer enquiries from WhatsApp, Instagram, and manual entry
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

      <LeadsTable leads={leads} />
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

/** De-duplicates and drops null conversation ids. */
function unique(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/**
 * Builds a per-conversation summary (last inbound message + total message count)
 * for the given conversation ids, from a single query per channel.
 * Capped at 5000 rows — enough for a small CRM; revisit if chats grow large.
 */
async function buildChatInfo(
  admin: ReturnType<typeof createAdminClient>,
  table: "whatsapp_messages" | "messenger_messages",
  conversationIds: string[]
): Promise<Map<string, { lastCustomerMsg: string | null; count: number }>> {
  const map = new Map<string, { lastCustomerMsg: string | null; count: number }>();
  if (conversationIds.length === 0) return map;

  const { data } = await admin
    .from(table)
    .select("conversation_id, direction, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true })
    .limit(5000);

  for (const row of (data ?? []) as Array<{
    conversation_id: string;
    direction: string;
    body: string | null;
  }>) {
    const cur = map.get(row.conversation_id) ?? { lastCustomerMsg: null, count: 0 };
    cur.count += 1;
    // Ascending order means the last inbound row we see is the most recent one.
    if (row.direction === "inbound" && typeof row.body === "string" && row.body.trim()) {
      cur.lastCustomerMsg = row.body;
    }
    map.set(row.conversation_id, cur);
  }
  return map;
}
