export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { CustomersTable, type CustomerInstall, type InstallPhoto } from "@/components/customers/customers-table";

/** Adds whole months to a date (keeps the same day-of-month where possible). */
function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d;
}

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to view installed customers.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "id, booking_ref, scheduled_at, completed_at, warranty_months, product_snapshot, qty_snapshot, technician, completion_notes, tech_notes, on_the_way_at, arrived_at, lead:leads(client_name, client_phone, location_address, location_url)"
    )
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(500);

  type RawInstall = Omit<CustomerInstall, "warrantyExpiry" | "warrantyActive" | "installedAt" | "photos"> & {
    completed_at: string | null;
    scheduled_at: string;
    warranty_months: number;
  };
  const rows = (data ?? []) as unknown as RawInstall[];

  // Photos for all listed installs, grouped by booking.
  const photosByBooking = new Map<string, InstallPhoto[]>();
  if (rows.length > 0) {
    const { data: photoRows } = await admin
      .from("booking_photos")
      .select("id, booking_id, url, kind, caption")
      .in(
        "booking_id",
        rows.map((r) => r.id)
      )
      .order("created_at", { ascending: true });
    for (const p of (photoRows ?? []) as (InstallPhoto & { booking_id: string })[]) {
      const list = photosByBooking.get(p.booking_id);
      if (list) list.push(p);
      else photosByBooking.set(p.booking_id, [p]);
    }
  }

  const now = Date.now();
  const installs: CustomerInstall[] = rows.map((r) => {
    // Warranty runs from the actual install (completed_at); fall back to the
    // scheduled date if a legacy row never stamped completion.
    const installedAt = r.completed_at ?? r.scheduled_at;
    const expiry = addMonths(installedAt, r.warranty_months ?? 12);
    return {
      id: r.id,
      booking_ref: r.booking_ref,
      product_snapshot: r.product_snapshot,
      qty_snapshot: r.qty_snapshot,
      technician: r.technician,
      completion_notes: r.completion_notes,
      tech_notes: r.tech_notes,
      on_the_way_at: r.on_the_way_at,
      arrived_at: r.arrived_at,
      completed_at: r.completed_at,
      lead: r.lead,
      installedAt,
      warrantyExpiry: expiry.toISOString(),
      warrantyActive: expiry.getTime() > now,
      photos: photosByBooking.get(r.id) ?? [],
    };
  });

  const total = installs.length;
  const underWarranty = installs.filter((i) => i.warrantyActive).length;
  const expired = total - underWarranty;

  return (
    <div>
      <RealtimeRefresh tables={["bookings"]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Customers
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Installed base — completed installations and their warranty status.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Installed" value={String(total)} />
        <StatCard label="Under warranty" value={String(underWarranty)} hint="active cover" />
        <StatCard label="Warranty expired" value={String(expired)} />
      </div>

      <CustomersTable installs={installs} />
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
