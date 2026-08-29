import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";

/**
 * Records a WhatsApp send/webhook event so it can be watched live from
 * /whatsapp/logs instead of digging through pm2 logs. Never throws — a
 * logging failure must never break the actual operation it's describing.
 */
export async function logWhatsAppDebugEvent(
  level: "info" | "warn" | "error",
  event: string,
  message: string,
  details?: unknown
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("whatsapp_debug_log").insert({
      user_id: getTenantId(),
      level,
      event,
      message,
      details: details ?? null,
    });
  } catch {
    // Swallow — this is a diagnostic side-channel, not critical path.
  }
}
