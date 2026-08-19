import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";

const CreateTechnicianSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  is_active: z.boolean().optional(),
});

/** GET /api/v1/technicians — list the user's technicians. */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data, error } = await supabase
    .from("technicians")
    .select("id, name, phone, is_active, created_at")
    .eq("user_id", tenantId)
    .order("name", { ascending: true });

  if (error) return apiError("LOAD_FAILED", error.message, 500);
  return apiSuccess({ technicians: data ?? [] });
}

/** POST /api/v1/technicians — add a technician. */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let parsed: z.infer<typeof CreateTechnicianSchema>;
  try {
    parsed = CreateTechnicianSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const phone = parsed.phone?.trim() || null;

  // Phone is the technician's login id, so it must be unique within this owner —
  // otherwise phone+passcode can't tell two technicians apart at /tech login.
  if (phone) {
    const { data: existing } = await supabase
      .from("technicians")
      .select("id")
      .eq("user_id", tenantId)
      .eq("phone", phone)
      .limit(1);
    if (existing && existing.length > 0) {
      return apiError(
        "DUPLICATE_PHONE",
        "Another technician already uses this phone number. Each technician needs a unique phone to log in.",
        409
      );
    }
  }

  const { data, error } = await supabase
    .from("technicians")
    .insert({
      user_id: tenantId,
      name: parsed.name.trim(),
      phone,
      is_active: parsed.is_active ?? true,
    })
    .select("id, name, phone, is_active, created_at")
    .single();

  if (error) return apiError("CREATE_FAILED", error.message, 500);
  return apiSuccess({ technician: data });
}
