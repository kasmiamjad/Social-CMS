import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { CALL_STATUS_VALUES } from "@/lib/lead-status";

const STATUS_VALUES = [
  "new",
  "contacted",
  "qualified",
  "quoted",
  "won",
  "lost",
  "scheduled",
  "installed",
  "in_service",
] as const;

const SOURCE_VALUES = [
  "manual",
  "whatsapp_ai",
  "instagram",
  "youtube",
  "website_form",
  "phone_call",
  "walk_in",
  "referral",
] as const;

const CreateLeadSchema = z.object({
  client_name: z.string().min(1).max(200),
  client_phone: z.string().max(40).optional().nullable(),
  client_email: z.string().email().optional().nullable(),
  client_business_type: z.string().max(100).optional().nullable(),
  client_code: z.string().max(40).optional().nullable(),
  qr_code: z.string().max(200).optional().nullable(),
  product_qty: z.number().int().min(1).max(9999).optional(),
  product_model: z.string().max(200).optional().nullable(),
  lead_date: z.string().optional().nullable(),
  installation_date: z.string().optional().nullable(),
  next_service_date: z.string().optional().nullable(),
  scope: z.string().max(2000).optional().nullable(),
  installed_by: z.string().max(100).optional().nullable(),
  location_address: z.string().max(500).optional().nullable(),
  location_url: z.string().max(1000).optional().nullable(),
  location_lat: z.number().optional().nullable(),
  location_lng: z.number().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  assigned_to: z.string().max(100).optional().nullable(),
  call_status: z.enum(CALL_STATUS_VALUES).optional().nullable(),
  status: z.enum(STATUS_VALUES).optional(),
  source: z.enum(SOURCE_VALUES).optional(),
  whatsapp_conversation_id: z.string().uuid().optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
  internal_notes: z.string().max(4000).optional().nullable(),
});

/**
 * GET /api/v1/leads
 *
 * List leads for the authenticated user. Supports basic query filters:
 *   ?status=new
 *   ?source=whatsapp_ai
 *   ?q=<search>   (matches client_name, client_phone, client_code)
 *   ?limit=50&offset=0
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const source = url.searchParams.get("source");
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

  const supabase = createAdminClient();
  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (q) {
    // Postgres ILIKE on multiple columns
    query = query.or(
      `client_name.ilike.%${q}%,client_phone.ilike.%${q}%,client_code.ilike.%${q}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return apiError("LOAD_FAILED", error.message, 500);

  return apiSuccess({
    leads: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}

/**
 * POST /api/v1/leads
 *
 * Create a new lead. serial_no is auto-assigned via the next_lead_serial_no function.
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let parsed: z.infer<typeof CreateLeadSchema>;
  try {
    parsed = CreateLeadSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();

  // Get the next per-user serial number
  const { data: nextNoData } = await supabase
    .rpc("next_lead_serial_no", { p_user_id: userId })
    .single<number>();
  const serial_no = typeof nextNoData === "number" ? nextNoData : 1;

  const payload = {
    user_id: userId,
    serial_no,
    client_name: parsed.client_name,
    client_phone: parsed.client_phone ?? null,
    client_email: parsed.client_email ?? null,
    client_business_type: parsed.client_business_type ?? null,
    client_code: parsed.client_code ?? null,
    qr_code: parsed.qr_code ?? null,
    product_qty: parsed.product_qty ?? 1,
    product_model: parsed.product_model ?? null,
    lead_date: parsed.lead_date ?? null,
    installation_date: parsed.installation_date ?? null,
    next_service_date: parsed.next_service_date ?? null,
    scope: parsed.scope ?? null,
    installed_by: parsed.installed_by ?? null,
    location_address: parsed.location_address ?? null,
    location_url: parsed.location_url ?? null,
    location_lat: parsed.location_lat ?? null,
    location_lng: parsed.location_lng ?? null,
    city: parsed.city ?? null,
    assigned_to: parsed.assigned_to ?? null,
    call_status: parsed.call_status ?? null,
    status: parsed.status ?? "new",
    source: parsed.source ?? "manual",
    whatsapp_conversation_id: parsed.whatsapp_conversation_id ?? null,
    remarks: parsed.remarks ?? null,
    internal_notes: parsed.internal_notes ?? null,
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select("*")
    .single();

  if (error) return apiError("CREATE_FAILED", error.message, 500);

  return apiSuccess({ lead: data });
}
