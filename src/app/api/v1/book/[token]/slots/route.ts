import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";

/**
 * GET /api/v1/book/:token/slots?date=YYYY-MM-DD
 *
 * PUBLIC (token-gated). Returns distinct available 1-hr time windows across all
 * active technicians for the given date — only times that have at least one
 * free slot. No auth: the booking_token is the capability.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date) return apiError("INVALID_REQUEST", "date is required", 400);

  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("leads")
    .select("user_id")
    .eq("booking_token", token)
    .maybeSingle<{ user_id: string }>();
  if (!lead) return apiError("NOT_FOUND", "Invalid link", 404);

  const { data: techs } = await admin
    .from("technicians")
    .select("id")
    .eq("user_id", lead.user_id)
    .eq("is_active", true);
  const techIds = (techs ?? []).map((t) => (t as { id: string }).id);
  if (techIds.length === 0) return apiSuccess({ times: [] });

  const { data: slots } = await admin
    .from("technician_slots")
    .select("start_time, end_time")
    .eq("user_id", lead.user_id)
    .in("technician_id", techIds)
    .eq("slot_date", date)
    .is("booking_id", null)
    .order("start_time", { ascending: true });

  // Distinct time windows (any technician free at that time).
  const seen = new Set<string>();
  const times: Array<{ start_time: string; end_time: string }> = [];
  for (const s of (slots ?? []) as Array<{ start_time: string; end_time: string }>) {
    if (seen.has(s.start_time)) continue;
    seen.add(s.start_time);
    times.push({ start_time: s.start_time, end_time: s.end_time });
  }

  return apiSuccess({ times });
}
