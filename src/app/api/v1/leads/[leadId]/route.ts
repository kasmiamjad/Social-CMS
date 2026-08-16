import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const STATUS_VALUES = [
  "new", "contacted", "qualified", "quoted", "won", "lost", "scheduled", "installed", "in_service",
] as const;

const CALL_STATUS_VALUES = ["not_interested", "unanswered", "follow_up", "converted"] as const;

const UpdateLeadSchema = z.object({
  client_name: z.string().min(1).max(200).optional(),
  client_phone: z.string().max(40).nullable().optional(),
  client_email: z.string().email().nullable().optional().or(z.literal("")),
  client_business_type: z.string().max(100).nullable().optional(),
  client_code: z.string().max(40).nullable().optional(),
  qr_code: z.string().max(200).nullable().optional(),
  product_qty: z.number().int().min(1).max(9999).optional(),
  product_model: z.string().max(200).nullable().optional(),
  lead_date: z.string().nullable().optional(),
  installation_date: z.string().nullable().optional(),
  next_service_date: z.string().nullable().optional(),
  scope: z.string().max(2000).nullable().optional(),
  installed_by: z.string().max(100).nullable().optional(),
  location_address: z.string().max(500).nullable().optional(),
  location_url: z.string().max(1000).nullable().optional(),
  location_lat: z.number().nullable().optional(),
  location_lng: z.number().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  assigned_to: z.string().max(100).nullable().optional(),
  call_status: z.enum(CALL_STATUS_VALUES).nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  remarks: z.string().max(2000).nullable().optional(),
  internal_notes: z.string().max(4000).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { leadId } = await context.params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return apiError("LOAD_FAILED", error.message, 500);
  if (!data) return apiError("NOT_FOUND", "Lead not found", 404);

  return apiSuccess({ lead: data });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { leadId } = await context.params;

  let parsed: z.infer<typeof UpdateLeadSchema>;
  try {
    parsed = UpdateLeadSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  // Drop undefined keys so we never overwrite a column the caller didn't send
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) payload[k] = v === "" ? null : v;
  }

  if (Object.keys(payload).length === 0) {
    return apiError("NO_CHANGES", "Provide at least one field to update.", 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", leadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) return apiError("UPDATE_FAILED", error.message, 500);
  if (!data) return apiError("NOT_FOUND", "Lead not found", 404);

  return apiSuccess({ lead: data });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);
  const { leadId } = await context.params;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("user_id", userId);

  if (error) return apiError("DELETE_FAILED", error.message, 500);

  return apiSuccess({ deleted: true });
}
