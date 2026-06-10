import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InstagramEngagementService } from "@/services/platforms/instagram/instagram-engagement.service";
import { InstagramEngagementAutoReplyService } from "@/services/instagram/engagement-auto-reply.service";
import type {
  InstagramWebhookPayload,
} from "@/services/platforms/instagram/instagram-engagement.types";

interface IgCredentials {
  account_id?: string;
  access_token?: string;
  app_secret?: string;
  verify_token?: string;
}

interface CredentialsRow {
  user_id: string;
  credentials: IgCredentials;
}

/**
 * GET /api/v1/instagram/webhook
 *
 * Meta subscription handshake. Echo hub.challenge IFF hub.verify_token
 * matches the verify_token saved by any active Instagram credentials row.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("platform_credentials")
    .select("credentials")
    .eq("platform", "instagram")
    .eq("is_active", true);

  if (error) {
    console.error("IG webhook verify: failed to query credentials", error);
    return new NextResponse("Server error", { status: 500 });
  }

  const matched = (rows ?? []).some((row) => {
    const creds = (row as { credentials?: IgCredentials }).credentials;
    return creds?.verify_token === token;
  });

  if (!matched) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * POST /api/v1/instagram/webhook
 *
 * Meta delivers Instagram messaging events (DMs) and comment events here.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  let payload: InstagramWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as InstagramWebhookPayload;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (payload.object !== "instagram") {
    return new NextResponse("OK", { status: 200 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const autoReply = new InstagramEngagementAutoReplyService();

  // entry.id is the IG Business Account ID — we use it to find which user
  // owns this account and load their credentials.
  for (const entry of payload.entry ?? []) {
    const accountId = entry.id;
    if (!accountId) continue;

    const credsRow = await lookupCredentialsByAccountId(accountId);
    if (!credsRow) {
      console.warn("IG webhook: no user found for account_id", accountId);
      continue;
    }

    const creds = credsRow.credentials;
    if (!creds.access_token || !creds.account_id) {
      console.warn("IG webhook: missing token/account for user", credsRow.user_id);
      continue;
    }

    // Verify HMAC signature with this user's app_secret
    if (creds.app_secret) {
      const ig = new InstagramEngagementService({
        account_id: creds.account_id,
        access_token: creds.access_token,
        app_secret: creds.app_secret,
        verify_token: creds.verify_token,
      });
      if (!ig.verifyWebhookSignature(rawBody, signatureHeader)) {
        console.warn("IG webhook: invalid signature for user", credsRow.user_id);
        continue;
      }
    }

    // ── DM events ──
    for (const event of entry.messaging ?? []) {
      try {
        await autoReply.processIncomingDm(
          credsRow.user_id,
          {
            account_id: creds.account_id,
            access_token: creds.access_token,
            app_secret: creds.app_secret,
            verify_token: creds.verify_token,
          },
          event
        );
      } catch (err) {
        console.error("IG webhook: processIncomingDm failed", {
          userId: credsRow.user_id,
          err,
        });
      }
    }

    // ── Comment events ──
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" && change.field !== "mentions") continue;
      try {
        await autoReply.processIncomingComment(
          credsRow.user_id,
          {
            account_id: creds.account_id,
            access_token: creds.access_token,
            app_secret: creds.app_secret,
            verify_token: creds.verify_token,
          },
          change.value
        );
      } catch (err) {
        console.error("IG webhook: processIncomingComment failed", {
          userId: credsRow.user_id,
          err,
        });
      }
    }
  }

  return new NextResponse("OK", { status: 200 });
}

async function lookupCredentialsByAccountId(accountId: string): Promise<CredentialsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("platform_credentials")
    .select("user_id, credentials")
    .eq("platform", "instagram")
    .eq("is_active", true);

  if (error || !data) return null;
  const match = data.find((row) => {
    const creds = (row as { credentials?: IgCredentials }).credentials;
    return creds?.account_id === accountId;
  });
  return (match as CredentialsRow | undefined) ?? null;
}
