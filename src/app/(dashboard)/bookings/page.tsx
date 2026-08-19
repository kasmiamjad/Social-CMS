export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import { BookingsTable, type BookingRow } from "@/components/bookings/bookings-table";
import { TableFilters } from "@/components/ui/table-filters";
import { TablePagination } from "@/components/ui/table-pagination";
import { buildChatInfo, uniqueConversationIds } from "@/lib/chat-info";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const PAGE_SIZE = 30;
const SELECT_COLS =
  "id, booking_ref, scheduled_at, slot_label, product_snapshot, qty_snapshot, total_amount, currency, technician, status, lead_id, lead:leads!inner(client_name, client_phone, whatsapp_conversation_id, messenger_conversation_id, location_url, location_address)";

interface BookingsPageProps {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to view bookings.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const tenantId = getTenantId();

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Active bookings only (completed installs live on Customers). Optional status
  // filter narrows within the active set.
  let query = admin
    .from("bookings")
    .select(SELECT_COLS, { count: "exact" })
    .eq("user_id", tenantId)
    .neq("status", "completed");

  if (status) query = query.eq("status", status);
  if (q) {
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (safe) query = query.or(`client_name.ilike.%${safe}%,client_phone.ilike.%${safe}%`, { referencedTable: "leads" });
  }

  const { data, count } = await query.order("scheduled_at", { ascending: true }).range(from, to);
  const totalMatching = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));

  type RawBooking = BookingRow & {
    lead: {
      client_name: string;
      client_phone: string | null;
      whatsapp_conversation_id: string | null;
      messenger_conversation_id: string | null;
      location_url: string | null;
      location_address: string | null;
    } | null;
  };
  const rawBookings = (data ?? []) as unknown as RawBooking[];

  // ── Stat cards (across all bookings) ────────────────────────────────────────
  const [totalRes, upcomingRes, completedRes, revenueRes] = await Promise.all([
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", tenantId),
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", tenantId).in("status", ["scheduled", "confirmed"]),
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", tenantId).eq("status", "completed"),
    admin.from("bookings").select("total_amount").eq("user_id", tenantId).neq("status", "cancelled").limit(5000),
  ]);
  const revenue = ((revenueRes.data ?? []) as { total_amount: number | null }[]).reduce(
    (sum, r) => sum + (r.total_amount ?? 0),
    0
  );

  // Last-customer-message + chat count for this page's bookings.
  const waIds = uniqueConversationIds(rawBookings.map((b) => b.lead?.whatsapp_conversation_id ?? null));
  const msgrIds = uniqueConversationIds(rawBookings.map((b) => b.lead?.messenger_conversation_id ?? null));
  const [waChat, msgrChat] = await Promise.all([
    buildChatInfo(admin, "whatsapp_messages", waIds),
    buildChatInfo(admin, "messenger_messages", msgrIds),
  ]);

  const bookings: BookingRow[] = rawBookings.map((b) => {
    const waId = b.lead?.whatsapp_conversation_id ?? null;
    const msgrId = b.lead?.messenger_conversation_id ?? null;
    const chat = waId ? waChat.get(waId) : msgrId ? msgrChat.get(msgrId) : undefined;
    return {
      ...b,
      last_customer_msg: chat?.lastCustomerMsg ?? null,
      chat_count: chat?.count ?? 0,
      chat_channel: waId ? "whatsapp" : msgrId ? "messenger" : null,
      chat_conversation_id: waId ?? msgrId ?? null,
    };
  });

  return (
    <div>
      <RealtimeRefresh tables={["bookings", "whatsapp_messages", "messenger_messages"]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Bookings
        </h1>
        <p className="text-sm text-text-muted mt-1">Confirmed installations scheduled from leads</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={String(totalRes.count ?? 0)} />
        <StatCard label="Upcoming" value={String(upcomingRes.count ?? 0)} hint="scheduled / confirmed" />
        <StatCard label="Completed" value={String(completedRes.count ?? 0)} hint="view in Customers →" href="/customers" />
        <StatCard label="Pipeline value" value={`SAR ${revenue.toLocaleString("en-US")}`} hint="excludes cancelled" />
      </div>

      <TableFilters
        searchPlaceholder="Search customer name or phone…"
        selects={[
          {
            param: "status",
            ariaLabel: "Status",
            options: [
              { value: "", label: "All active" },
              { value: "scheduled", label: "Scheduled" },
              { value: "confirmed", label: "Confirmed" },
              { value: "on_the_way", label: "On the way" },
              { value: "arrived", label: "Arrived" },
              { value: "no_show", label: "No-show" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
      />

      <BookingsTable bookings={bookings} />

      <TablePagination page={page} totalPages={totalPages} total={totalMatching} noun="booking" />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
      {hint && <div className="text-[10px] text-text-muted mt-1">{hint}</div>}
    </>
  );
  const className = "block rounded-xl border border-border bg-surface-elevated p-4";
  return href ? (
    <Link href={href} className={`${className} hover:border-primary/40 transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
