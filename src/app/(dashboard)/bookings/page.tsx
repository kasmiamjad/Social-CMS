export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingsTable, type BookingRow } from "@/components/bookings/bookings-table";

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
      "id, booking_ref, scheduled_at, slot_label, product_snapshot, qty_snapshot, total_amount, currency, technician, status, lead_id, lead:leads(client_name, client_phone)"
    )
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: true })
    .limit(500);

  const bookings = (data ?? []) as unknown as BookingRow[];

  // Stats
  const total = bookings.length;
  const upcoming = bookings.filter((b) => ["scheduled", "confirmed"].includes(b.status)).length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const revenue = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.total_amount ?? 0), 0);

  return (
    <div>
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
