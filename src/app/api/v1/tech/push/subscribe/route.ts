import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getTechSession } from "@/lib/tech-auth";

const SubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

/**
 * POST /api/v1/tech/push/subscribe
 * Stores (or refreshes) a Web Push subscription for the signed-in technician.
 * Upserts by endpoint so re-subscribing the same device doesn't duplicate.
 */
export async function POST(request: NextRequest) {
  const session = await getTechSession();
  if (!session) return apiError("UNAUTHORIZED", "Not signed in.", 401);

  let parsed: z.infer<typeof SubscribeSchema>;
  try {
    parsed = SubscribeSchema.parse(await request.json());
  } catch {
    return apiError("INVALID_REQUEST", "Invalid push subscription.", 400);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("tech_push_subscriptions").upsert(
    {
      user_id: session.uid,
      technician_id: session.tid,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) return apiError("SAVE_FAILED", "Could not save subscription.", 500, error.message);
  return apiSuccess({ subscribed: true });
}

/**
 * DELETE /api/v1/tech/push/subscribe
 * Removes a subscription (technician turned alerts off on this device).
 */
export async function DELETE(request: NextRequest) {
  const session = await getTechSession();
  if (!session) return apiError("UNAUTHORIZED", "Not signed in.", 401);

  let endpoint: string;
  try {
    endpoint = z.object({ endpoint: z.string().url() }).parse(await request.json()).endpoint;
  } catch {
    return apiError("INVALID_REQUEST", "Endpoint required.", 400);
  }

  const admin = createAdminClient();
  await admin
    .from("tech_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("technician_id", session.tid);

  return apiSuccess({ unsubscribed: true });
}
