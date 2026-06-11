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
      "id, serial_no, client_code, client_name, client_phone, client_business_type, product_qty, product_model, installation_date, next_service_date, scope, installed_by, location_address, location_url, status, source, remarks, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const leads = (data ?? []) as LeadRow[];

  // Stats
  const total = leads.length;
  const won = leads.filter((l) => l.status === "won" || l.status === "installed" || l.status === "in_service").length;
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
