/**
 * Runs once when the Next.js server process boots (see
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
 * Used to establish the long-lived Baileys WhatsApp Web socket before any
 * request arrives, so inbound messages are captured immediately.
 *
 * Deliberately NOT awaited — Next.js won't start serving HTTP traffic until
 * register() resolves, and the Baileys connection involves outbound network
 * calls (fetching WhatsApp's protocol version, contacting Supabase) that
 * could hang. A WhatsApp connectivity problem must never be able to take
 * the whole CRM down; it should fail/retry in the background instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initBaileysConnection } = await import("@/services/platforms/whatsapp-baileys/baileys-connection");
  void initBaileysConnection();
}
