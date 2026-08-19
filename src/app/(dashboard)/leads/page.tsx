export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadsTable, type LeadRow } from "@/components/leads/leads-table";
import { TableFilters } from "@/components/ui/table-filters";
import { TablePagination } from "@/components/ui/table-pagination";
import { buildChatInfo, uniqueConversationIds } from "@/lib/chat-info";
import { buildFollowupInfo } from "@/lib/followup-info";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Plus } from "lucide-react";

/** Lead sources created by the AI bot rather than a person. */
const BOT_SOURCES = new Set(["whatsapp_ai", "facebook", "instagram", "youtube"]);

/** Statuses still in the open pipeline — the only ones shown on the Leads list.
 * Scheduled/installed/in-service move to Bookings; won/lost drop out of the list. */
const OPEN_STATUSES = ["new", "contacted", "qualified", "quoted"];
const WON_STATUSES = ["won", "scheduled", "installed", "in_service"];

const PAGE_SIZE = 30;
const SELECT_COLS =
  "id, serial_no, client_code, client_name, client_phone, client_business_type, product_qty, product_model, installation_date, next_service_date, scope, installed_by, location_address, location_url, city, assigned_to, call_status, status, source, remarks, created_at, whatsapp_conversation_id, messenger_conversation_id, instagram_conversation_id";

interface LeadsPageProps {
  searchParams: Promise<{ page?: string; q?: string; source?: string; status?: string }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
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

  // ── Parse filters / page from the URL ──────────────────────────────────────
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const source = sp.source ?? "";
  const status = sp.status && OPEN_STATUSES.includes(sp.status) ? sp.status : "";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // The account owner's name, used as the "Added by" label for manual leads.
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null }>();
  const ownerName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Team";

  // ── Filtered, paginated page of leads (+ total match count) ─────────────────
  let query = admin
    .from("leads")
    .select(SELECT_COLS, { count: "exact" })
    .eq("user_id", user.id)
    .in("status", status ? [status] : OPEN_STATUSES);

  if (source) query = query.eq("source", source);
  if (q) {
    // Strip characters that would break the PostgREST or() filter syntax.
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (safe) query = query.or(`client_name.ilike.%${safe}%,client_phone.ilike.%${safe}%`);
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalMatching = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));

  const rawLeads = (data ?? []) as Array<
    LeadRow & {
      whatsapp_conversation_id: string | null;
      messenger_conversation_id: string | null;
      instagram_conversation_id: string | null;
    }
  >;

  // ── Stat cards: counts across ALL leads, independent of the current filter ──
  const [totalRes, openRes, wonRes, waRes] = await Promise.all([
    admin.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", OPEN_STATUSES),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", WON_STATUSES),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("source", "whatsapp_ai"),
  ]);

  // ── Last-customer-message + chat count for the current page's leads ─────────
  const waIds = uniqueConversationIds(rawLeads.map((l) => l.whatsapp_conversation_id));
  const msgrIds = uniqueConversationIds(rawLeads.map((l) => l.messenger_conversation_id));
  const igIds = uniqueConversationIds(rawLeads.map((l) => l.instagram_conversation_id));
  const [waChat, msgrChat, igChat] = await Promise.all([
    buildChatInfo(admin, "whatsapp_messages", waIds),
    buildChatInfo(admin, "messenger_messages", msgrIds),
    buildChatInfo(admin, "instagram_dm_messages", igIds),
  ]);

  const followupInfo = await buildFollowupInfo(admin, rawLeads.map((l) => l.id));

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
      next_followup: followupInfo.get(l.id)?.date ?? null,
    };
  });

  return (
    <div>
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
        <div className="flex items-center gap-2">
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
          >
            <Plus size={14} strokeWidth={2} />
            New Lead
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={totalRes.count ?? 0} />
        <StatCard label="Open" value={openRes.count ?? 0} hint="new / contacted / qualified / quoted" />
        <StatCard label="Won" value={wonRes.count ?? 0} hint="won / installed / in service" />
        <StatCard label="From WhatsApp" value={waRes.count ?? 0} />
      </div>

      <TableFilters
        searchPlaceholder="Search name or phone…"
        selects={[
          {
            param: "source",
            ariaLabel: "Source",
            options: [
              { value: "", label: "All sources" },
              { value: "whatsapp_ai", label: "WhatsApp" },
              { value: "facebook", label: "Messenger" },
              { value: "instagram", label: "Instagram" },
              { value: "manual", label: "Manual" },
            ],
          },
          {
            param: "status",
            ariaLabel: "Status",
            options: [
              { value: "", label: "All open" },
              { value: "new", label: "New" },
              { value: "contacted", label: "Contacted" },
              { value: "qualified", label: "Qualified" },
              { value: "quoted", label: "Quoted" },
            ],
          },
        ]}
      />

      <LeadsTable leads={leads} />

      <TablePagination page={page} totalPages={totalPages} total={totalMatching} noun="lead" />
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
