import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Web Push helper for the technician PWA. Reads VAPID keys from the environment:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (also used client-side to subscribe)
 *   VAPID_PRIVATE_KEY             (server secret)
 *   VAPID_SUBJECT                 (mailto: or https: contact; optional)
 *
 * Everything here is best-effort: if the keys aren't configured we silently skip
 * sending so booking creation never fails because push isn't set up.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@a3sixty.com";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface TechPushPayload {
  title: string;
  body: string;
  /** Path the notification opens, e.g. /tech/bookings/<id>. */
  url: string;
  tag?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends a push to every stored subscription for a technician. Stale endpoints
 * (404/410) are pruned. Never throws.
 */
export async function sendPushToTechnician(
  technicianId: string,
  payload: TechPushPayload
): Promise<void> {
  if (!ensureConfigured()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("tech_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("technician_id", technicianId);

  const rows = (subs ?? []) as SubscriptionRow[];
  if (rows.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    rows.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (err) {
        const code =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        // Gone / not found → the subscription is dead; remove it.
        if (code === 404 || code === 410) {
          await admin.from("tech_push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("web push send failed", { subscription: s.id, code });
        }
      }
    })
  );
}
