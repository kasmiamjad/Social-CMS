import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
  DEFAULT_WHATSAPP_SYSTEM_PROMPT,
} from "@/services/platforms/whatsapp/whatsapp.constants";

const UpdateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  auto_reply: z.boolean().optional(),
  system_prompt: z.string().min(10).max(40000).optional(),
  signature_suffix: z.string().max(200).optional(),
  business_hours_enabled: z.boolean().optional(),
  business_hours_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  business_hours_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  business_hours_timezone: z.string().max(60).nullable().optional(),
  out_of_hours_message: z.string().max(4096).nullable().optional(),
});

/**
 * GET /api/v1/whatsapp/automation-config
 *
 * Returns the user's saved automation config, or safe defaults if none exists.
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data, error } = await supabase
    .from("whatsapp_automation_configs")
    .select("*")
    .eq("user_id", tenantId)
    .maybeSingle();

  if (error) {
    return apiError("LOAD_FAILED", error.message, 500);
  }

  return apiSuccess({
    config: data ?? {
      enabled: false,
      auto_reply: false,
      system_prompt: DEFAULT_WHATSAPP_SYSTEM_PROMPT,
      signature_suffix: DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
      business_hours_enabled: false,
      business_hours_start: null,
      business_hours_end: null,
      business_hours_timezone: "UTC",
      out_of_hours_message: null,
    },
  });
}

/**
 * PUT /api/v1/whatsapp/automation-config
 *
 * Upserts the user's automation config. Pass only the fields you want to change.
 */
export async function PUT(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }

  let parsed: z.infer<typeof UpdateConfigSchema>;
  try {
    parsed = UpdateConfigSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();

  // Build payload: fill required fields with defaults if this is the first insert
  const payload: Record<string, unknown> = {
    user_id: tenantId,
    enabled: parsed.enabled ?? false,
    auto_reply: parsed.auto_reply ?? false,
    system_prompt: parsed.system_prompt ?? DEFAULT_WHATSAPP_SYSTEM_PROMPT,
    signature_suffix: parsed.signature_suffix ?? DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
    business_hours_enabled: parsed.business_hours_enabled ?? false,
    business_hours_start: parsed.business_hours_start ?? null,
    business_hours_end: parsed.business_hours_end ?? null,
    business_hours_timezone: parsed.business_hours_timezone ?? "UTC",
    out_of_hours_message: parsed.out_of_hours_message ?? null,
  };

  const { data, error } = await supabase
    .from("whatsapp_automation_configs")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    return apiError("SAVE_FAILED", error.message, 500);
  }

  return apiSuccess({ config: data });
}
