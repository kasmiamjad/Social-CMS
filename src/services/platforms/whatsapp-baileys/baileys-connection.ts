import { Boom } from "@hapi/boom";
import qrcode from "qrcode";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
  proto,
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
  const tenantId = getTenantId();
  const { state, saveCreds } = await makeSupabaseAuthState(tenantId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    version,
    browser: ["SA'DA H2O CRM", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => void onConnectionUpdate(tenantId, sock, update));
  sock.ev.on("messages.upsert", ({ messages, type }) => void onMessagesUpsert(tenantId, sock, messages, type));
  sock.ev.on("messages.update", (updates) => void onMessagesUpdate(tenantId, updates));

  return sock;
}

async function onConnectionUpdate(
  tenantId: string,
  sock: WASocket,
  update: Partial<ConnectionState>
): Promise<void> {
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

    sockPromise = null;

    if (loggedOut) {
      // The phone unlinked us — a fresh QR scan is required, don't auto-reconnect.
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
    await delay(3000);
    void getBaileysSocket();
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
