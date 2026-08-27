import { Boom } from "@hapi/boom";
import qrcode from "qrcode";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
  proto,
  isJidBroadcast,
  isJidNewsletter,
  isJidMetaAI,
  type WASocket,
  type WAMessage,
  type MessageUpsertType,
  type ConnectionState,
  type WAMessageUpdate,
} from "@whiskeysockets/baileys";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import { makeSupabaseAuthState, clearBaileysAuthState } from "./baileys-auth-store";
import { handleIncomingBaileysMessage } from "./baileys-message-adapter";
import { baileysLogger as logger } from "./baileys-logger";

let sockPromise: Promise<WASocket> | null = null;
// Bumped on every new connect() attempt so a superseded socket's late-firing
// close event (from a previous, now-replaced connection) can recognize it's
// stale and not race with — or stomp on — whatever the current one is doing.
let generation = 0;

/** Returns the singleton Baileys socket, connecting it on first call. Safe to call from any request. */
export async function getBaileysSocket(): Promise<WASocket> {
  if (!sockPromise) {
    sockPromise = connect();
  }
  return sockPromise;
}

/** Boots the connection once at server startup — see instrumentation.ts. */
export async function initBaileysConnection(): Promise<void> {
  try {
    await getBaileysSocket();
  } catch (err) {
    console.error("[baileys] Initial connection attempt failed", { err });
  }
}

/**
 * Logs the linked device out (triggered from the Settings "Disconnect"
 * button). Baileys reports this back through connection.update as a
 * logged-out close, which clears the stored session and status there.
 */
export async function disconnectBaileys(): Promise<void> {
  if (!sockPromise) return;
  const sock = await sockPromise;
  await sock.logout().catch(() => {});
}

async function connect(): Promise<WASocket> {
  const myGeneration = ++generation;
  const tenantId = getTenantId();
  const { state, saveCreds } = await makeSupabaseAuthState(tenantId);
  const version = await fetchVersionWithTimeout();

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    ...(version ? { version } : {}),
    // Deliberately NOT overriding `browser` — WhatsApp's servers appear to
    // treat a custom browser-identification string with more suspicion than
    // Baileys' own default. This, together with the settings below, is the
    // full config a community fix for a persistent connectionReplaced/
    // reconnect-storm bug matching what we hit used — not just the browser
    // change alone (https://github.com/WhiskeySockets/Baileys/issues/2249).
    keepAliveIntervalMs: 20_000,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    retryRequestDelayMs: 5_000,
    // Skip broadcast/newsletter/Meta AI JIDs — NOT groups, since we still
    // want those (see baileys-message-adapter.ts's group handling).
    shouldIgnoreJid: (jid) => Boolean(isJidBroadcast(jid) || isJidNewsletter(jid) || isJidMetaAI(jid)),
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => void onConnectionUpdate(tenantId, sock, update, myGeneration));
  sock.ev.on("messages.upsert", ({ messages, type }) => void onMessagesUpsert(tenantId, sock, messages, type));
  sock.ev.on("messages.update", (updates) => void onMessagesUpdate(tenantId, updates));

  return sock;
}

/**
 * Fetches the current WhatsApp Web protocol version, with a hard timeout —
 * this is an outbound network call, and a hang here must never be able to
 * stall the whole connection (or, at boot, the whole server). Falls back to
 * Baileys' own bundled default version (version is optional to makeWASocket)
 * if the check fails or times out.
 */
async function fetchVersionWithTimeout(): Promise<[number, number, number] | undefined> {
  try {
    const { version } = await fetchLatestBaileysVersion({ signal: AbortSignal.timeout(8000) });
    return version;
  } catch (err) {
    console.warn("[baileys] Version check failed or timed out — using bundled default version", { err });
    return undefined;
  }
}

async function onConnectionUpdate(
  tenantId: string,
  sock: WASocket,
  update: Partial<ConnectionState>,
  myGeneration: number
): Promise<void> {
  // A newer connect() has already taken over — this socket is a leftover
  // from a superseded attempt (e.g. its own delayed reconnect firing late).
  // Acting on it here is exactly what caused the connectionReplaced (440)
  // loop: two live sockets fighting over the same session.
  if (myGeneration !== generation) return;

  const { connection, lastDisconnect, qr } = update;
  const supabase = createAdminClient();

  if (qr) {
    const qrDataUrl = await qrcode.toDataURL(qr);
    await supabase
      .from("whatsapp_connection_status")
      .upsert({ user_id: tenantId, status: "qr_pending", qr_code: qrDataUrl }, { onConflict: "user_id" });
  }

  if (connection === "open") {
    // Prefer the explicit phone-number field — sock.user.id may be in
    // privacy-preserving LID format instead of a phone number on newer accounts.
    const rawId = sock.user?.phoneNumber ?? sock.user?.id ?? null;
    const connectedNumber = rawId ? rawId.split(":")[0].split("@")[0] : null;
    await supabase.from("whatsapp_connection_status").upsert(
      {
        user_id: tenantId,
        status: "connected",
        qr_code: null,
        connected_number: connectedNumber,
        last_connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    console.log("[baileys] Connected", { connectedNumber });
  }

  if (connection === "close") {
    const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
    const loggedOut = statusCode === DisconnectReason.loggedOut;
    console.warn("[baileys] Connection closed", { statusCode, loggedOut });

    if (loggedOut) {
      // The phone unlinked us — a fresh QR scan is required, don't auto-reconnect.
      sockPromise = null;
      await clearBaileysAuthState(tenantId);
      await supabase
        .from("whatsapp_connection_status")
        .upsert(
          { user_id: tenantId, status: "disconnected", qr_code: null, connected_number: null },
          { onConflict: "user_id" }
        );
      return;
    }

    // Network hiccup / server restart — reconnect after a short backoff.
    // sockPromise is reassigned directly to the pending reconnect (never set
    // to null first) so any concurrent getBaileysSocket() caller awaits THIS
    // same reconnect instead of racing to start a second, conflicting one.
    sockPromise = (async () => {
      await delay(3000);
      return connect();
    })();
  }
}

async function onMessagesUpsert(
  tenantId: string,
  sock: WASocket,
  messages: WAMessage[],
  type: MessageUpsertType
): Promise<void> {
  if (type !== "notify") return;
  for (const message of messages) {
    try {
      await handleIncomingBaileysMessage(sock, tenantId, message);
    } catch (err) {
      console.error("[baileys] Failed to process incoming message", { err });
    }
  }
}

/** Maps Baileys' ack-level updates onto whatsapp_messages.status (best-effort — see plan notes on reliability). */
async function onMessagesUpdate(tenantId: string, updates: WAMessageUpdate[]): Promise<void> {
  const supabase = createAdminClient();
  for (const { key, update } of updates) {
    if (!key.id || update.status == null) continue;
    const status = mapAckToStatus(update.status);
    if (!status) continue;
    await supabase
      .from("whatsapp_messages")
      .update({ status })
      .eq("wa_message_id", key.id)
      .eq("user_id", tenantId);
  }
}

function mapAckToStatus(ack: number): "sent" | "delivered" | "read" | "failed" | null {
  switch (ack) {
    case proto.WebMessageInfo.Status.ERROR:
      return "failed";
    case proto.WebMessageInfo.Status.SERVER_ACK:
      return "sent";
    case proto.WebMessageInfo.Status.DELIVERY_ACK:
      return "delivered";
    case proto.WebMessageInfo.Status.READ:
    case proto.WebMessageInfo.Status.PLAYED:
      return "read";
    default:
      return null;
  }
}
