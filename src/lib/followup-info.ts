import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Builds a per-lead "next follow-up" summary (most recent still-pending
 * entry) for the given lead ids, from a single query. Capped at 2000 rows —
 * enough for a page of leads with a healthy follow-up history each.
 */
export async function buildFollowupInfo(
  admin: ReturnType<typeof createAdminClient>,
  leadIds: string[]
): Promise<Map<string, { date: string; note: string | null }>> {
  const map = new Map<string, { date: string; note: string | null }>();
  if (leadIds.length === 0) return map;

  const { data } = await admin
    .from("lead_followups")
    .select("lead_id, follow_up_date, note, created_at")
    .in("lead_id", leadIds)
    .is("completed_at", null)
    .order("follow_up_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);

  for (const row of (data ?? []) as Array<{
    lead_id: string;
    follow_up_date: string;
    note: string | null;
  }>) {
    // Rows arrive most-recent-first per the query order, so the first row
    // seen for a lead is its latest follow-up — skip if already set.
    if (!map.has(row.lead_id)) {
      map.set(row.lead_id, { date: row.follow_up_date, note: row.note });
    }
  }
  return map;
}
