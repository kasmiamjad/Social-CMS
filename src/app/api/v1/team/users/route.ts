import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const CreateUserSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/** GET /api/v1/team/users — list every login in this system. */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const admin = createAdminClient();

  const [{ data: authList, error: authError }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("profiles").select("id, display_name, created_at"),
  ]);

  if (authError) return apiError("LOAD_FAILED", authError.message, 500);

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const users = (authList?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      full_name: (profileById.get(u.id)?.display_name as string | undefined) ?? u.email ?? "",
      created_at: u.created_at,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return apiSuccess({ users });
}

/** POST /api/v1/team/users — create a new login for this system. */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let parsed: z.infer<typeof CreateUserSchema>;
  try {
    parsed = CreateUserSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.full_name },
  });

  if (error) {
    const isDuplicate = error.message.toLowerCase().includes("already");
    return apiError(isDuplicate ? "DUPLICATE" : "CREATE_FAILED", error.message, isDuplicate ? 409 : 500);
  }

  return apiSuccess({
    user: {
      id: data.user.id,
      email: data.user.email ?? "",
      full_name: parsed.full_name,
      created_at: data.user.created_at,
    },
  });
}
