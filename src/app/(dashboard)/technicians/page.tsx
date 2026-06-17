export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TechniciansManager, type Technician } from "@/components/technicians/technicians-manager";

export default async function TechniciansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Technicians</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to manage technicians.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("technicians")
    .select("id, name, phone, is_active, created_at")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  const technicians = (data ?? []) as Technician[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Technicians
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Manage your install team and their daily availability slots
        </p>
      </div>

      <TechniciansManager initialTechnicians={technicians} />
    </div>
  );
}
