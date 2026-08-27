import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { BaileysWhatsAppService, BaileysSendError } from "@/services/platforms/whatsapp-baileys/baileys-whatsapp.service";
import { getBaileysSocket } from "@/services/platforms/whatsapp-baileys/baileys-connection";

const SendBodySchema = z.object({
  to: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+?\d+$/, "to must be E.164 phone digits (with or without leading +)"),
  body: z.string().min(1).max(4096),
});

/**
 * POST /api/v1/whatsapp/send
 *
 * Manually send a free-form WhatsApp text message to a contact.
 *
 * Body: { to: "+1234567890", body: "Hello" }
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }

  let parsed: z.infer<typeof SendBodySchema>;
  try {
    parsed = SendBodySchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data: connectionStatus } = await supabase
    .from("whatsapp_connection_status")
    .select("status")
    .eq("user_id", tenantId)
    .maybeSingle<{ status: string }>();

  if (connectionStatus?.status !== "connected") {
    return apiError("WHATSAPP_NOT_CONNECTED", "Scan the WhatsApp QR code in Settings first.", 400);
  }

  const wa = new BaileysWhatsAppService(await getBaileysSocket());

  try {
    const result = await wa.sendTextMessage(parsed.to, parsed.body);

    // Upsert conversation + persist outbound message
    const contactPhone = parsed.to.startsWith("+") ? parsed.to : `+${parsed.to}`;
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          user_id: tenantId,
          contact_phone: contactPhone,
          last_message_at: new Date().toISOString(),
          last_message_preview: parsed.body.slice(0, 200),
        },
        { onConflict: "user_id,contact_phone" }
      )
      .select("id")
      .single<{ id: string }>();

    if (conversation) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        user_id: tenantId,
        wa_message_id: result.messageId,
        direction: "outbound",
        message_type: "text",
        body: parsed.body,
        status: "sent",
        ai_generated: false,
        sent_at: new Date().toISOString(),
      });
    }

    return apiSuccess({
      message_id: result.messageId,
      to: contactPhone,
    });
  } catch (err) {
    if (err instanceof BaileysSendError) {
      console.error("[whatsapp/send] Baileys rejected the send", { userId, to: parsed.to, message: err.message });
      return apiError("WHATSAPP_SEND_ERROR", err.message, 502);
    }
    console.error("[whatsapp/send] Unexpected failure", { userId, to: parsed.to, err });
    return apiError(
      "UNEXPECTED_ERROR",
      err instanceof Error ? err.message : "Unknown error",
      500
    );
  }
}
