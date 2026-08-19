export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TableFilters } from "@/components/ui/table-filters";
import { TablePagination } from "@/components/ui/table-pagination";
import { CustomersTable, type CustomerInstall, type InstallPhoto } from "@/components/customers/customers-table";

const PAGE_SIZE = 30;
const SELECT_COLS =
  "id, booking_ref, scheduled_at, completed_at, warranty_months, warranty_expires_at, product_snapshot, qty_snapshot, technician, completion_notes, tech_notes, on_the_way_at, arrived_at, lead:leads!inner(client_name, client_phone, location_address, location_url)";

/** Adds whole months to a date (fallback for legacy rows with no completed_at). */
function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d;
}

interface CustomersPageProps {
  searchParams: Promise<{ page?: string; q?: string; warranty?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
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
  const tenantId = getTenantId();
  const nowIso = new Date().toISOString();

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const warranty = sp.warranty === "active" || sp.warranty === "expired" ? sp.warranty : "";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Completed installs, optionally filtered by warranty state + name/phone search.
  let query = admin
    .from("bookings")
    .select(SELECT_COLS, { count: "exact" })
    .eq("user_id", tenantId)
    .eq("status", "completed");

  if (warranty === "active") query = query.gt("warranty_expires_at", nowIso);
  else if (warranty === "expired") query = query.lte("warranty_expires_at", nowIso);
  if (q) {
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (safe) query = query.or(`client_name.ilike.%${safe}%,client_phone.ilike.%${safe}%`, { referencedTable: "leads" });
  }

  const { data, count } = await query
    .order("completed_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  const totalMatching = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));

  type RawInstall = Omit<CustomerInstall, "warrantyExpiry" | "warrantyActive" | "installedAt" | "photos"> & {
    completed_at: string | null;
    scheduled_at: string;
    warranty_months: number;
    warranty_expires_at: string | null;
  };
  const rows = (data ?? []) as unknown as RawInstall[];

  // ── Stat cards (across all completed installs) ──────────────────────────────
  const [totalRes, activeRes] = await Promise.all([
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", tenantId).eq("status", "completed"),
    admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", tenantId)
      .eq("status", "completed")
      .gt("warranty_expires_at", nowIso),
  ]);
  const totalInstalled = totalRes.count ?? 0;
  const underWarranty = activeRes.count ?? 0;
  const expired = Math.max(0, totalInstalled - underWarranty);

  // Photos for this page's installs, grouped by booking.
  const photosByBooking = new Map<string, InstallPhoto[]>();
  if (rows.length > 0) {
    const { data: photoRows } = await admin
      .from("booking_photos")
      .select("id, booking_id, url, kind, caption")
      .in("booking_id", rows.map((r) => r.id))
      .order("created_at", { ascending: true });
    for (const p of (photoRows ?? []) as (InstallPhoto & { booking_id: string })[]) {
      const list = photosByBooking.get(p.booking_id);
      if (list) list.push(p);
      else photosByBooking.set(p.booking_id, [p]);
    }
  }

  const now = Date.now();
  const installs: CustomerInstall[] = rows.map((r) => {
    const installedAt = r.completed_at ?? r.scheduled_at;
    const expiry = r.warranty_expires_at
      ? new Date(r.warranty_expires_at)
      : addMonths(installedAt, r.warranty_months ?? 12);
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
        <StatCard label="Installed" value={String(totalInstalled)} />
        <StatCard label="Under warranty" value={String(underWarranty)} hint="active cover" />
        <StatCard label="Warranty expired" value={String(expired)} />
      </div>

      <TableFilters
        searchPlaceholder="Search customer name or phone…"
        selects={[
          {
            param: "warranty",
            ariaLabel: "Warranty",
            options: [
              { value: "", label: "All warranty" },
              { value: "active", label: "Under warranty" },
              { value: "expired", label: "Expired" },
            ],
          },
        ]}
      />

      <CustomersTable installs={installs} />

      <TablePagination page={page} totalPages={totalPages} total={totalMatching} noun="customer" />
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
