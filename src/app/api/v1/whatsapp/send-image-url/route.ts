import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";
import { WhatsAppService, WhatsAppApiError } from "@/services/platforms/whatsapp/whatsapp.service";
import type { WhatsAppCredentials } from "@/services/platforms/whatsapp/whatsapp.types";

interface PlatformCredentialsRow {
  credentials: WhatsAppCredentials;
}

const SendImageUrlSchema = z.object({
  to: z.string().regex(/^\+?\d{8,20}$/),
  media_url: z.string().url(),
  caption: z.string().max(4096).optional(),
});

/**
 * POST /api/v1/whatsapp/send-image-url
 *
 * Sends an image that's already hosted (e.g. a quick-reply template's saved
 * image) without re-uploading it — unlike /send-media, which expects a fresh
 * file. Same 24-hour customer service window restriction applies.
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let parsed: z.infer<typeof SendImageUrlSchema>;
  try {
    parsed = SendImageUrlSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data: credsRow, error: credsError } = await supabase
    .from("platform_credentials")
    .select("credentials")
    .eq("user_id", tenantId)
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
  const contactPhone = parsed.to.startsWith("+") ? parsed.to : `+${parsed.to}`;

  try {
    const result = await wa.sendImageMessage(contactPhone, parsed.media_url, parsed.caption || undefined);

    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          user_id: tenantId,
          contact_phone: contactPhone,
          last_message_at: new Date().toISOString(),
          last_message_preview: parsed.caption || "📷 Image",
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
        message_type: "image",
        body: parsed.caption || null,
        media_url: parsed.media_url,
        status: "sent",
        ai_generated: false,
        sent_at: new Date().toISOString(),
      });
    }

    return apiSuccess({ message_id: result.messageId, to: contactPhone, media_url: parsed.media_url });
  } catch (err) {
    if (err instanceof WhatsAppApiError) {
      console.error("[whatsapp/send-image-url] Meta API rejected the send", {
        userId,
        to: contactPhone,
        statusCode: err.statusCode,
        message: err.message,
        apiError: err.apiError,
      });
      return apiError("WHATSAPP_API_ERROR", err.message, err.statusCode, err.apiError);
    }
    console.error("[whatsapp/send-image-url] Unexpected failure", { userId, to: contactPhone, err });
    return apiError("UNEXPECTED_ERROR", err instanceof Error ? err.message : "Unknown error", 500);
  }
}
