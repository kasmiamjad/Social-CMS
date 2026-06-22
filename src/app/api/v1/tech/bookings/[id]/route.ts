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
  // All optional: a request may change status, edit job notes, or both.
  status: z.enum(TECH_SETTABLE).optional(),
  completion_notes: z.string().trim().max(2000).optional(),
  tech_notes: z.string().trim().max(4000).optional(),
});

/**
 * PATCH /api/v1/tech/bookings/[id]
 * Lets the assigned technician advance their own booking's status (stamping the
 * matching timestamp) and/or save working notes. Scoped to the tech session
 * (owner + technician id); no Supabase auth — the signed tech cookie gates
 * access, the admin client writes. Notes can be edited even on locked jobs; only
 * status transitions are blocked once a job is completed/cancelled.
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
    return apiError("INVALID_REQUEST", "Invalid request body.", 400);
  }

  if (parsed.status === undefined && parsed.tech_notes === undefined && parsed.completion_notes === undefined) {
    return apiError("NO_CHANGES", "Nothing to update.", 400);
  }

  const { id } = await params;
  const admin = createAdminClient();

  // Load the booking scoped to this technician so they can't touch others' jobs.
  const { data: existing } = await admin
    .from("bookings")
    .select("id, lead_id, status, on_the_way_at, arrived_at, completed_at")
    .eq("id", id)
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .maybeSingle<{
      id: string;
      lead_id: string;
      status: string;
      on_the_way_at: string | null;
      arrived_at: string | null;
      completed_at: string | null;
    }>();

  if (!existing) {
    return apiError("NOT_FOUND", "Booking not found.", 404);
  }
  // A locked job blocks *status* changes only — notes stay editable.
  if (parsed.status !== undefined && LOCKED_STATUSES.includes(existing.status)) {
    return apiError(
      "STATUS_LOCKED",
      `This job is ${existing.status.replace(/_/g, " ")} and its status can no longer be changed here.`,
      409
    );
  }

  const update: Record<string, string | null> = {};

  if (parsed.status !== undefined) {
    update.status = parsed.status;
    // Stamp the step's timestamp the first time we reach it (idempotent re-taps
    // keep the original moment).
    const tsCol = STATUS_TIMESTAMP[parsed.status];
    if (tsCol && !existing[tsCol as keyof typeof existing]) {
      update[tsCol] = new Date().toISOString();
    }
  }
  if (parsed.completion_notes !== undefined) {
    update.completion_notes = parsed.completion_notes || null;
  }
  if (parsed.tech_notes !== undefined) {
    update.tech_notes = parsed.tech_notes || null;
  }

  const { data: updated, error } = await admin
    .from("bookings")
    .update(update)
    .eq("id", id)
    .eq("user_id", session.uid)
    .eq("technician_id", session.tid)
    .select("id, status, on_the_way_at, arrived_at, completed_at, completion_notes, tech_notes")
    .single();

  if (error) {
    return apiError("UPDATE_FAILED", "Could not save the changes.", 500, error.message);
  }

  // When the visit is completed, advance the lead to 'installed' so the pipeline
  // and the Customers (installed-base) page reflect it. Best-effort: a failure
  // here shouldn't fail the tech's status update.
  if (parsed.status === "completed" && existing.status !== "completed") {
    await admin
      .from("leads")
      .update({ status: "installed" })
      .eq("id", existing.lead_id)
      .eq("user_id", session.uid);
  }

  return apiSuccess({ booking: updated });
}
