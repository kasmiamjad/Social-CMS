import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MessengerService } from "@/services/platforms/messenger/messenger.service";
import { MessengerAutoReplyService } from "@/services/messenger/auto-reply.service";
import type {
  MessengerCredentials,
  MessengerWebhookPayload,
} from "@/services/platforms/messenger/messenger.types";

interface PlatformCredentialsRow {
  user_id: string;
  credentials: MessengerCredentials;
}

/**
 * GET /api/v1/messenger/webhook
 *
 * Meta's subscription handshake. Echo hub.challenge IFF hub.verify_token matches
 * any active Messenger credential row.
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
    .eq("platform", "messenger")
    .eq("is_active", true);

  if (error) {
    console.error("Messenger webhook verification: failed to query credentials", error);
    return new NextResponse("Server error", { status: 500 });
  }

  const matched = (rows ?? []).some((row) => {
    const creds = (row as { credentials?: MessengerCredentials }).credentials;
    return creds?.verify_token === token;
  });

  if (!matched) return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * POST /api/v1/messenger/webhook
 *
 * Incoming Messenger events. Look up the user by Page id, verify the HMAC
 * signature with that user's app_secret, then process each messaging event.
 * Always returns 200 quickly — Meta retries non-2xx aggressively.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  let payload: MessengerWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MessengerWebhookPayload;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (payload.object !== "page") {
    return new NextResponse("OK", { status: 200 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");

  for (const entry of payload.entry ?? []) {
    const pageId = entry.id;
    if (!pageId) continue;

    const credsRow = await lookupCredentialsByPageId(pageId);
    if (!credsRow) {
      console.warn("Messenger webhook: no user found for page_id", pageId);
      continue;
    }

    const messenger = new MessengerService(credsRow.credentials);
    if (!messenger.verifyWebhookSignature(rawBody, signatureHeader)) {
      console.warn("Messenger webhook: invalid signature for user", credsRow.user_id);
      continue;
    }

    const autoReply = new MessengerAutoReplyService();
    for (const event of entry.messaging ?? []) {
      if (!event.message) continue; // skip delivery/read receipts, postbacks for now
      try {
        await autoReply.processIncomingMessage(credsRow.user_id, credsRow.credentials, event);
      } catch (err) {
        console.error("Messenger webhook: processIncomingMessage failed", {
          userId: credsRow.user_id,
          mid: event.message?.mid,
          err,
        });
      }
    }
  }

  return new NextResponse("OK", { status: 200 });
}

async function lookupCredentialsByPageId(
  pageId: string
): Promise<PlatformCredentialsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("platform_credentials")
    .select("user_id, credentials")
    .eq("platform", "messenger")
    .eq("is_active", true);

  if (error || !data) return null;

  const match = data.find((row) => {
    const creds = (row as { credentials?: MessengerCredentials }).credentials;
    return creds?.page_id === pageId;
  });

  return (match as PlatformCredentialsRow | undefined) ?? null;
}
