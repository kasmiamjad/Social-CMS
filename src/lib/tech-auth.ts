import crypto from "crypto";
import { cookies } from "next/headers";

export const TECH_COOKIE = "tech_session";
const SESSION_DAYS = 30;

function secret(): string {
  return process.env.TECH_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret";
}

// ── Passcode hashing (scrypt) ───────────────────────────────────────────────

/** Hashes a passcode as "scrypt:<saltHex>:<hashHex>". */
export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(passcode, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Verifies a passcode against a stored "scrypt:salt:hash". */
export function verifyPasscode(passcode: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = crypto.scryptSync(passcode, salt, 64);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ── Signed session token ────────────────────────────────────────────────────

interface TechSession {
  tid: string; // technician id
  uid: string; // owner user id
  exp: number; // epoch ms
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signs a technician session into a compact token (payload.signature). */
export function signTechSession(technicianId: string, ownerUserId: string): string {
  const payload: TechSession = {
    tid: technicianId,
    uid: ownerUserId,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

/** Verifies a token and returns the session, or null. */
export function verifyTechSession(token: string | undefined): TechSession | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  try {
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as TechSession;
    if (!payload.tid || !payload.uid || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Reads + verifies the technician session from the cookie (server-side). */
export async function getTechSession(): Promise<TechSession | null> {
  const store = await cookies();
  return verifyTechSession(store.get(TECH_COOKIE)?.value);
}

export const TECH_COOKIE_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
