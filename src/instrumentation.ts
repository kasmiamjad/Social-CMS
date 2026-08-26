/**
 * Runs once when the Next.js server process boots (see
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
 * Used to establish the long-lived Baileys WhatsApp Web socket before any
 * request arrives, so inbound messages are captured immediately.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initBaileysConnection } = await import("@/services/platforms/whatsapp-baileys/baileys-connection");
  await initBaileysConnection();
}
