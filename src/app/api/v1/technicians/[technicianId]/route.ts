import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const UpdateTechnicianSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  is_active: z.boolean().optional(),
});

/** PATCH /api/v1/technicians/:technicianId */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ technicianId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { technicianId } = await context.params;

  let parsed: z.infer<typeof UpdateTechnicianSchema>;
  try {
    parsed = UpdateTechnicianSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const payload: Record<string, unknown> = {};
  if (parsed.name !== undefined) payload.name = parsed.name.trim();
  if (parsed.phone !== undefined) payload.phone = parsed.phone?.trim() || null;
  if (parsed.is_active !== undefined) payload.is_active = parsed.is_active;
  if (Object.keys(payload).length === 0) {
    return apiError("NO_CHANGES", "Provide at least one field to update.", 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("technicians")
    .update(payload)
    .eq("id", technicianId)
    .eq("user_id", userId)
    .select("id, name, phone, is_active, created_at")
    .single();

  if (error) return apiError("UPDATE_FAILED", error.message, 500);
  if (!data) return apiError("NOT_FOUND", "Technician not found", 404);
  return apiSuccess({ technician: data });
}

/** DELETE /api/v1/technicians/:technicianId (cascades its slots). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ technicianId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { technicianId } = await context.params;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("technicians")
    .delete()
    .eq("id", technicianId)
    .eq("user_id", userId);

  if (error) return apiError("DELETE_FAILED", error.message, 500);
  return apiSuccess({ deleted: true });
}
