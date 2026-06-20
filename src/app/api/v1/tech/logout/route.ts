import { apiSuccess } from "@/lib/api-response";
import { TECH_COOKIE } from "@/lib/tech-auth";

/** POST /api/v1/tech/logout — clears the technician session cookie. */
export async function POST() {
  const res = apiSuccess({ ok: true });
  res.cookies.set(TECH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
