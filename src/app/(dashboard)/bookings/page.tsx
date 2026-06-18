export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingsTable, type BookingRow } from "@/components/bookings/bookings-table";
import { buildChatInfo, uniqueConversationIds } from "@/lib/chat-info";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export default async function BookingsPage() {
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
  const { data } = await admin
    .from("bookings")
    .select(
      "id, booking_ref, scheduled_at, slot_label, product_snapshot, qty_snapshot, total_amount, currency, technician, status, lead_id, lead:leads(client_name, client_phone, whatsapp_conversation_id, messenger_conversation_id, location_url, location_address)"
    )
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: true })
    .limit(500);

  type RawBooking = BookingRow & {
    lead:
      | {
          client_name: string;
          client_phone: string | null;
          whatsapp_conversation_id: string | null;
          messenger_conversation_id: string | null;
          location_url: string | null;
          location_address: string | null;
        }
      | null;
  };
  const rawBookings = (data ?? []) as unknown as RawBooking[];

  // Last-customer-message + chat count for each booking's linked conversation.
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

  // Stats
  const total = bookings.length;
  const upcoming = bookings.filter((b) => ["scheduled", "confirmed"].includes(b.status)).length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const revenue = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.total_amount ?? 0), 0);

  return (
    <div>
      <RealtimeRefresh tables={["bookings", "whatsapp_messages", "messenger_messages"]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Bookings
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Confirmed installations scheduled from leads
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={String(total)} />
        <StatCard label="Upcoming" value={String(upcoming)} hint="scheduled / confirmed" />
        <StatCard label="Completed" value={String(completed)} />
        <StatCard label="Pipeline value" value={`SAR ${revenue.toLocaleString("en-US")}`} hint="excludes cancelled" />
      </div>

      <BookingsTable bookings={bookings} />
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
      {hint && <div className="text-[10px] text-text-muted mt-1">{hint}</div>}
    </div>
  );
}
