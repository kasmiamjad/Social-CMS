export const dynamic = "force-dynamic";

import { getTechSession } from "@/lib/tech-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobCard, type TechJob } from "@/components/tech/job-card";

function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function TechTodayPage() {
  const session = await getTechSession();
  if (!session) return null;

  const today = riyadhToday();
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "id, scheduled_at, slot_label, product_snapshot, qty_snapshot, status, lead:leads(client_name, client_phone, location_url, location_address)"
    )
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .neq("status", "cancelled")
    .gte("scheduled_at", `${today}T00:00:00+03:00`)
    .lte("scheduled_at", `${today}T23:59:59+03:00`)
    .order("scheduled_at", { ascending: true });

  const jobs = (data ?? []) as unknown as TechJob[];

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Today&apos;s jobs</h1>
      <p className="text-sm text-text-muted mb-5">
        {jobs.length === 0 ? "Nothing scheduled for today." : `${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
      </p>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center text-sm text-text-muted">
          You have no installations today. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
