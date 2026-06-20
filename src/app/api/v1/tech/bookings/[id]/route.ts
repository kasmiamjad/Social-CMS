import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getTechSession } from "@/lib/tech-auth";

// Statuses a technician is allowed to set from the field panel. Everything else
// (scheduled, confirmed, cancelled) stays admin-controlled.
const TECH_SETTABLE = ["on_the_way", "arrived", "completed", "no_show"] as const;

// Once a booking reaches one of these, the tech can no longer change it — a
// cancellation or completed visit is final from the field side (admin can undo).
const LOCKED_STATUSES = ["completed", "cancelled"];

// Which timestamp column a status transition stamps (if not already set).
const STATUS_TIMESTAMP: Record<string, string> = {
  on_the_way: "on_the_way_at",
  arrived: "arrived_at",
  completed: "completed_at",
};

const PatchSchema = z.object({
  status: z.enum(TECH_SETTABLE),
  completion_notes: z.string().trim().max(2000).optional(),
});

/**
 * PATCH /api/v1/tech/bookings/[id]
 * Lets the assigned technician advance their own booking's status and stamp the
 * matching timestamp. Scoped to the tech session (owner + technician id); no
 * Supabase auth — the signed tech cookie gates access, the admin client writes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTechSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Not signed in.", 401);
  }

  let parsed: z.infer<typeof PatchSchema>;
  try {
    parsed = PatchSchema.parse(await request.json());
  } catch {
    return apiError("INVALID_REQUEST", "A valid status is required.", 400);
  }

  const { id } = await params;
  const admin = createAdminClient();

  // Load the booking scoped to this technician so they can't touch others' jobs.
  const { data: existing } = await admin
    .from("bookings")
    .select("id, status, on_the_way_at, arrived_at, completed_at")
    .eq("id", id)
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .maybeSingle<{
      id: string;
      status: string;
      on_the_way_at: string | null;
      arrived_at: string | null;
      completed_at: string | null;
    }>();

  if (!existing) {
    return apiError("NOT_FOUND", "Booking not found.", 404);
  }
  if (LOCKED_STATUSES.includes(existing.status)) {
    return apiError(
      "STATUS_LOCKED",
      `This job is ${existing.status.replace(/_/g, " ")} and can no longer be changed here.`,
      409
    );
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, string | null> = { status: parsed.status };

  // Stamp the step's timestamp the first time we reach it (idempotent re-taps
  // keep the original moment).
  const tsCol = STATUS_TIMESTAMP[parsed.status];
  if (tsCol && !existing[tsCol as keyof typeof existing]) {
    update[tsCol] = nowIso;
  }
  if (parsed.completion_notes !== undefined) {
    update.completion_notes = parsed.completion_notes || null;
  }

  const { data: updated, error } = await admin
    .from("bookings")
    .update(update)
    .eq("id", id)
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .select("id, status, on_the_way_at, arrived_at, completed_at, completion_notes")
    .single();

  if (error) {
    return apiError("UPDATE_FAILED", "Could not update the job status.", 500, error.message);
  }

  return apiSuccess({ booking: updated });
}
