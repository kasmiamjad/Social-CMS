import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { WhatsAppService, WhatsAppApiError } from "@/services/platforms/whatsapp/whatsapp.service";
import type { WhatsAppCredentials } from "@/services/platforms/whatsapp/whatsapp.types";

const SendBodySchema = z.object({
  to: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+?\d+$/, "to must be E.164 phone digits (with or without leading +)"),
  body: z.string().min(1).max(4096),
});

interface PlatformCredentialsRow {
  credentials: WhatsAppCredentials;
}

/**
 * POST /api/v1/whatsapp/send
 *
 * Manually send a free-form WhatsApp text message to a contact.
 * NOTE: Only allowed inside the 24-hour customer service window.
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

  // Load user's WhatsApp credentials
  const supabase = createAdminClient();
  const { data: credsRow, error: credsError } = await supabase
    .from("platform_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "whatsapp")
    .eq("is_active", true)
    .maybeSingle<PlatformCredentialsRow>();

  if (credsError || !credsRow) {
    return apiError(
      "WHATSAPP_NOT_CONNECTED",
      "Connect WhatsApp Cloud API credentials in Settings first.",
      400
    );
  }

  const wa = new WhatsAppService(credsRow.credentials);

  try {
    const result = await wa.sendTextMessage(parsed.to, parsed.body);

    // Upsert conversation + persist outbound message
    const contactPhone = parsed.to.startsWith("+") ? parsed.to : `+${parsed.to}`;
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          user_id: userId,
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
        user_id: userId,
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
    if (err instanceof WhatsAppApiError) {
      console.error("[whatsapp/send] Meta API rejected the send", {
        userId,
        to: parsed.to,
        statusCode: err.statusCode,
        message: err.message,
        apiError: err.apiError,
      });
      return apiError("WHATSAPP_API_ERROR", err.message, err.statusCode, err.apiError);
    }
    console.error("[whatsapp/send] Unexpected failure", { userId, to: parsed.to, err });
    return apiError(
      "UNEXPECTED_ERROR",
      err instanceof Error ? err.message : "Unknown error",
      500
    );
  }
}
