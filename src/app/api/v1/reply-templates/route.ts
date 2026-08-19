import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";

const SHORTCUT_RE = /^[a-z0-9_-]{1,40}$/;

const CreateTemplateSchema = z.object({
  shortcut: z.string().regex(SHORTCUT_RE, "Lowercase letters, numbers, - and _ only"),
  message: z.string().min(1).max(4096),
});

/** GET /api/v1/reply-templates — list this account's quick-reply templates. */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data, error } = await supabase
    .from("reply_templates")
    .select("*")
    .eq("user_id", tenantId)
    .order("shortcut", { ascending: true });

  if (error) return apiError("LOAD_FAILED", error.message, 500);

  return apiSuccess({ templates: data ?? [] });
}

/** POST /api/v1/reply-templates — create a new quick-reply template. */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let parsed: z.infer<typeof CreateTemplateSchema>;
  try {
    parsed = CreateTemplateSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data, error } = await supabase
    .from("reply_templates")
    .insert({ user_id: tenantId, shortcut: parsed.shortcut, message: parsed.message })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return apiError("DUPLICATE", `A template with shortcut "/${parsed.shortcut}" already exists`, 409);
    }
    return apiError("CREATE_FAILED", error.message, 500);
  }

  return apiSuccess({ template: data });
}
