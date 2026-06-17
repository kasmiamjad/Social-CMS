import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM 24h

const CreateSlotSchema = z.object({
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "slot_date must be YYYY-MM-DD"),
  start_time: z.string().regex(TIME_RE, "start_time must be HH:MM"),
  end_time: z.string().regex(TIME_RE, "end_time must be HH:MM"),
});

/**
 * GET /api/v1/technicians/:technicianId/slots?date=YYYY-MM-DD
 * Returns the technician's slots for a date (with their booking, if taken).
 * Pass ?open=true to return only free slots.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ technicianId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { technicianId } = await context.params;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const openOnly = url.searchParams.get("open") === "true";
  if (!date) return apiError("INVALID_REQUEST", "date query param is required", 400);

  const supabase = createAdminClient();
  let query = supabase
    .from("technician_slots")
    .select("id, slot_date, start_time, end_time, booking_id, booking:bookings(booking_ref)")
    .eq("user_id", userId)
    .eq("technician_id", technicianId)
    .eq("slot_date", date)
    .order("start_time", { ascending: true });

  if (openOnly) query = query.is("booking_id", null);

  const { data, error } = await query;
  if (error) return apiError("LOAD_FAILED", error.message, 500);
  return apiSuccess({ slots: data ?? [] });
}

/**
 * POST /api/v1/technicians/:technicianId/slots
 * Adds an availability slot { slot_date, start_time, end_time }.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ technicianId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { technicianId } = await context.params;

  let parsed: z.infer<typeof CreateSlotSchema>;
  try {
    parsed = CreateSlotSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  if (parsed.start_time >= parsed.end_time) {
    return apiError("INVALID_REQUEST", "Start time must be before end time.", 400);
  }

  // Verify the technician belongs to this user before adding a slot to it.
  const supabase = createAdminClient();
  const { data: tech } = await supabase
    .from("technicians")
    .select("id")
    .eq("id", technicianId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();
  if (!tech) return apiError("NOT_FOUND", "Technician not found", 404);

  const { data, error } = await supabase
    .from("technician_slots")
    .insert({
      user_id: userId,
      technician_id: technicianId,
      slot_date: parsed.slot_date,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
    })
    .select("id, slot_date, start_time, end_time, booking_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return apiError("DUPLICATE_SLOT", "A slot with that start time already exists for this day.", 409);
    }
    return apiError("CREATE_FAILED", error.message, 500);
  }
  return apiSuccess({ slot: data });
}
