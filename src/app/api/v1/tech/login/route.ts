import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";
import { verifyPasscode, signTechSession, TECH_COOKIE, TECH_COOKIE_MAX_AGE } from "@/lib/tech-auth";

const LoginSchema = z.object({
  phone: z.string().min(3).max(40),
  passcode: z.string().min(1).max(64),
});

/**
 * POST /api/v1/tech/login
 * Technician login by phone + passcode. Sets a signed session cookie.
 */
export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof LoginSchema>;
  try {
    parsed = LoginSchema.parse(await request.json());
  } catch {
    return apiError("INVALID_REQUEST", "Phone and passcode are required.", 400);
  }

  const phone = parsed.phone.trim();
  const admin = createAdminClient();

  // Match by phone (could be a couple of rows); verify passcode against each.
  const { data: techs } = await admin
    .from("technicians")
    .select("id, user_id, name, phone, passcode_hash, is_active")
    .eq("phone", phone);

  const match = (techs ?? []).find(
    (t) =>
      (t as { is_active: boolean }).is_active &&
      verifyPasscode(parsed.passcode, (t as { passcode_hash: string | null }).passcode_hash)
  ) as { id: string; user_id: string; name: string } | undefined;

  if (!match) {
    return apiError("INVALID_CREDENTIALS", "Wrong phone or passcode.", 401);
  }

  const token = signTechSession(match.id, match.user_id);
  const res = apiSuccess({ technician: { id: match.id, name: match.name } });
  res.cookies.set(TECH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TECH_COOKIE_MAX_AGE,
  });
  return res;
}
