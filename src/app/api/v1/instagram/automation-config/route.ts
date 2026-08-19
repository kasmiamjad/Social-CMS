import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  DEFAULT_INSTAGRAM_COMMENT_SYSTEM_PROMPT,
  DEFAULT_INSTAGRAM_DM_SYSTEM_PROMPT,
  DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
} from "@/services/platforms/instagram/instagram-engagement.constants";

const UpdateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  dms_enabled: z.boolean().optional(),
  dms_auto_reply: z.boolean().optional(),
  dms_system_prompt: z.string().min(10).max(20000).optional(),
  comments_enabled: z.boolean().optional(),
  comments_auto_reply: z.boolean().optional(),
  comments_system_prompt: z.string().min(10).max(20000).optional(),
  signature_suffix: z.string().max(200).optional(),
  business_hours_enabled: z.boolean().optional(),
  business_hours_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  business_hours_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  business_hours_timezone: z.string().max(60).nullable().optional(),
  out_of_hours_message: z.string().max(4096).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data, error } = await supabase
    .from("instagram_automation_configs")
    .select("*")
    .eq("user_id", tenantId)
    .maybeSingle();

  if (error) return apiError("LOAD_FAILED", error.message, 500);

  return apiSuccess({
    config: data ?? {
      enabled: false,
      dms_enabled: false,
      dms_auto_reply: false,
      dms_system_prompt: DEFAULT_INSTAGRAM_DM_SYSTEM_PROMPT,
      comments_enabled: false,
      comments_auto_reply: false,
      comments_system_prompt: DEFAULT_INSTAGRAM_COMMENT_SYSTEM_PROMPT,
      signature_suffix: DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
      business_hours_enabled: false,
      business_hours_start: null,
      business_hours_end: null,
      business_hours_timezone: "UTC",
      out_of_hours_message: null,
    },
  });
}

export async function PUT(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

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

  // Fetch existing to merge — never wipe a field the user didn't send
  const { data: existing } = await supabase
    .from("instagram_automation_configs")
    .select("*")
    .eq("user_id", tenantId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    user_id: tenantId,
    enabled: parsed.enabled ?? existing?.enabled ?? false,
    dms_enabled: parsed.dms_enabled ?? existing?.dms_enabled ?? false,
    dms_auto_reply: parsed.dms_auto_reply ?? existing?.dms_auto_reply ?? false,
    dms_system_prompt:
      parsed.dms_system_prompt ?? existing?.dms_system_prompt ?? DEFAULT_INSTAGRAM_DM_SYSTEM_PROMPT,
    comments_enabled: parsed.comments_enabled ?? existing?.comments_enabled ?? false,
    comments_auto_reply: parsed.comments_auto_reply ?? existing?.comments_auto_reply ?? false,
    comments_system_prompt:
      parsed.comments_system_prompt ?? existing?.comments_system_prompt ?? DEFAULT_INSTAGRAM_COMMENT_SYSTEM_PROMPT,
    signature_suffix:
      parsed.signature_suffix ?? existing?.signature_suffix ?? DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
    business_hours_enabled: parsed.business_hours_enabled ?? existing?.business_hours_enabled ?? false,
    business_hours_start: parsed.business_hours_start ?? existing?.business_hours_start ?? null,
    business_hours_end: parsed.business_hours_end ?? existing?.business_hours_end ?? null,
    business_hours_timezone: parsed.business_hours_timezone ?? existing?.business_hours_timezone ?? "UTC",
    out_of_hours_message: parsed.out_of_hours_message ?? existing?.out_of_hours_message ?? null,
  };

  const { data, error } = await supabase
    .from("instagram_automation_configs")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return apiError("SAVE_FAILED", error.message, 500);

  return apiSuccess({ config: data });
}
