export const dynamic = "force-dynamic";

import { getTechSession } from "@/lib/tech-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobCard, type TechJob } from "@/components/tech/job-card";

export default async function TechBookingsPage() {
  const session = await getTechSession();
  if (!session) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "id, scheduled_at, slot_label, product_snapshot, qty_snapshot, status, lead:leads(client_name, client_phone, location_url, location_address)"
    )
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .order("scheduled_at", { ascending: false })
    .limit(200);

  const jobs = (data ?? []) as unknown as TechJob[];

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">All bookings</h1>
      <p className="text-sm text-text-muted mb-5">
        {jobs.length} job{jobs.length === 1 ? "" : "s"} assigned to you
      </p>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center text-sm text-text-muted">
          No bookings assigned to you yet.
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} showDate />
          ))}
        </div>
      )}
    </div>
  );
}
