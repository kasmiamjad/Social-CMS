import { createAdminClient } from "@/lib/supabase/admin";
import { generateOpenRouterJsonResponse } from "@/lib/openrouter";
import { WhatsAppService, WhatsAppApiError } from "@/services/platforms/whatsapp/whatsapp.service";
import {
  DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
  DEFAULT_WHATSAPP_SYSTEM_PROMPT,
  WHATSAPP_AI_JSON_CONTRACT,
} from "@/services/platforms/whatsapp/whatsapp.constants";
import type {
  WhatsAppAIDecision,
  WhatsAppCredentials,
  WhatsAppIncomingMessage,
  WhatsAppContact,
} from "@/services/platforms/whatsapp/whatsapp.types";

interface WhatsAppAutomationConfigRow {
  enabled: boolean;
  auto_reply: boolean;
  system_prompt: string;
  signature_suffix: string;
  business_hours_enabled: boolean;
  business_hours_start: string | null;
  business_hours_end: string | null;
  business_hours_timezone: string | null;
  out_of_hours_message: string | null;
}

interface PlatformCredentialsRow {
  credentials: {
    api_key?: string;
  };
}

/**
 * Handles an incoming WhatsApp message end-to-end:
 *   1. Upserts the conversation row.
 *   2. Persists the inbound message.
 *   3. If automation is enabled, generates an AI reply via OpenRouter.
 *   4. Sends the reply via Cloud API (if auto_reply is on).
 *   5. Persists the outbound message + updates conversation aggregate.
 *
 * Handles business-hours logic and skips spam intents.
 */
export class WhatsAppAutoReplyService {
  /**
   * Process one inbound WhatsApp message for a given user.
   * Returns the AI decision summary for logging / API responses.
   */
  async processIncomingMessage(
    userId: string,
    credentials: WhatsAppCredentials,
    contact: WhatsAppContact | undefined,
    message: WhatsAppIncomingMessage
  ): Promise<{
    conversationId: string;
    inboundMessageId: string;
    aiDecision: WhatsAppAIDecision | null;
    outboundMessageId: string | null;
    skippedReason: string | null;
  }> {
    const supabase = createAdminClient();
    const wa = new WhatsAppService(credentials);

    // 1. Upsert conversation
    const contactPhone = `+${message.from}`;
    const contactName = contact?.profile?.name ?? null;
    const messagePreview = extractMessagePreview(message);

    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          user_id: userId,
          contact_phone: contactPhone,
          contact_name: contactName,
          last_message_at: new Date(Number(message.timestamp) * 1000).toISOString(),
          last_message_preview: messagePreview.slice(0, 200),
        },
        { onConflict: "user_id,contact_phone" }
      )
      .select("id, ai_paused")
      .single<{ id: string; ai_paused: boolean }>();

    if (convError || !conversation) {
      throw new Error(`Failed to upsert WhatsApp conversation: ${convError?.message}`);
    }

    // 2. Persist inbound message
    const { data: inbound, error: inboundError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversation.id,
        user_id: userId,
        wa_message_id: message.id,
        direction: "inbound",
        message_type: message.type,
        body: messagePreview || null,
        status: "received",
        raw_payload: message,
        sent_at: new Date(Number(message.timestamp) * 1000).toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    if (inboundError || !inbound) {
      // If unique constraint hits (duplicate webhook), don't crash — just skip.
      if (inboundError?.code === "23505") {
        return {
          conversationId: conversation.id,
          inboundMessageId: "duplicate",
          aiDecision: null,
          outboundMessageId: null,
          skippedReason: "duplicate_webhook",
        };
      }
      throw new Error(`Failed to persist inbound message: ${inboundError?.message}`);
    }

    // Acknowledge read (best-effort, don't fail flow).
    try {
      await wa.markAsRead(message.id);
    } catch (err) {
      console.warn("Failed to mark message read", { messageId: message.id, err });
    }

    // 3a. Short-circuit if AI is paused for this specific conversation.
    // The message is already stored — only the AI reply is skipped so a
    // human can take over from the dashboard.
    if (conversation.ai_paused) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "ai_paused_for_conversation",
      };
    }

    // 3. Load automation config — short-circuit if disabled
    const config = await this.getConfig(userId);
    if (!config.enabled || !config.auto_reply) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: !config.enabled ? "automation_disabled" : "auto_reply_disabled",
      };
    }

    // 4. Business hours check
    if (config.business_hours_enabled && !isWithinBusinessHours(config)) {
      // Send out-of-hours message if configured
      if (config.out_of_hours_message?.trim()) {
        try {
          const sent = await wa.sendTextMessage(contactPhone, config.out_of_hours_message);
          await this.persistOutboundMessage(supabase, {
            conversationId: conversation.id,
            userId,
            waMessageId: sent.messageId,
            body: config.out_of_hours_message,
            aiGenerated: false,
          });
        } catch (err) {
          console.error("Failed to send out-of-hours message", err);
        }
      }
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "out_of_hours",
      };
    }

    // 5. Get AI decision
    if (message.type !== "text" || !message.text?.body) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "non_text_message",
      };
    }

    const apiKey = await this.getOpenRouterApiKey(userId);
    const history = await this.fetchConversationHistory(conversation.id, inbound.id);
    const decision = await this.getAIDecision(
      config.system_prompt || DEFAULT_WHATSAPP_SYSTEM_PROMPT,
      contactName,
      message.text.body,
      config.signature_suffix || DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
      history,
      apiKey
    );

    // 6. Send reply if AI decided yes
    if (!decision.should_reply || !decision.reply?.trim()) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: decision,
        outboundMessageId: null,
        skippedReason: "ai_decided_skip",
      };
    }

    try {
      const sent = await wa.sendTextMessage(contactPhone, decision.reply);
      const outboundId = await this.persistOutboundMessage(supabase, {
        conversationId: conversation.id,
        userId,
        waMessageId: sent.messageId,
        body: decision.reply,
        aiGenerated: true,
      });
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: decision,
        outboundMessageId: outboundId,
        skippedReason: null,
      };
    } catch (err) {
      const reason = err instanceof WhatsAppApiError ? err.message : "send_failed";
      console.error("Failed to send WhatsApp AI reply", { contactPhone, err });
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: decision,
        outboundMessageId: null,
        skippedReason: reason,
      };
    }
  }

  /**
   * Loads the user's automation config or returns safe defaults.
   */
  private async getConfig(userId: string): Promise<WhatsAppAutomationConfigRow> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("whatsapp_automation_configs")
      .select(
        "enabled, auto_reply, system_prompt, signature_suffix, business_hours_enabled, business_hours_start, business_hours_end, business_hours_timezone, out_of_hours_message"
      )
      .eq("user_id", userId)
      .maybeSingle<WhatsAppAutomationConfigRow>();

    return (
      data ?? {
        enabled: false,
        auto_reply: false,
        system_prompt: DEFAULT_WHATSAPP_SYSTEM_PROMPT,
        signature_suffix: DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
        business_hours_enabled: false,
        business_hours_start: null,
        business_hours_end: null,
        business_hours_timezone: null,
        out_of_hours_message: null,
      }
    );
  }

  private async getOpenRouterApiKey(userId: string): Promise<string | undefined> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("platform_credentials")
      .select("credentials")
      .eq("user_id", userId)
      .eq("platform", "openrouter")
      .maybeSingle<PlatformCredentialsRow>();

    return data?.credentials?.api_key;
  }

  /**
   * Fetches the last N messages of a conversation (oldest → newest) to use
   * as conversation history for the LLM. Excludes the just-inserted inbound
   * message (which we pass separately as the current userMessage).
   */
  private async fetchConversationHistory(
    conversationId: string,
    currentInboundId: string,
    limit: number = 30
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("id, direction, body")
      .eq("conversation_id", conversationId)
      .neq("id", currentInboundId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (!data) return [];

    return data
      .filter((m) => typeof m.body === "string" && m.body.trim().length > 0)
      .map((m) => ({
        role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: m.body as string,
      }));
  }

  private async getAIDecision(
    systemPrompt: string,
    contactName: string | null,
    message: string,
    signatureSuffix: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    apiKey?: string
  ): Promise<WhatsAppAIDecision> {
    // LLM_MODEL is the new generic name. OPENROUTER_CLAUDE_MODEL kept for back-compat.
    // Defaults to a cheap, capable OpenAI model so works out-of-the-box with OPENAI_API_KEY.
    const model =
      process.env.LLM_MODEL ??
      process.env.OPENROUTER_CLAUDE_MODEL ??
      "gpt-4o-mini";
    const fullSystemPrompt = systemPrompt.trimEnd() + WHATSAPP_AI_JSON_CONTRACT;

    const decision = await generateOpenRouterJsonResponse<WhatsAppAIDecision>({
      model,
      systemPrompt: fullSystemPrompt,
      apiKey,
      history,
      userMessage: JSON.stringify({
        contact_name: contactName ?? "",
        message,
      }),
    });

    const finalReply = appendSignatureIfPresent(decision.reply, signatureSuffix);

    return {
      should_reply: Boolean(decision.should_reply),
      reply: finalReply,
      intent: decision.intent ?? null,
    };
  }

  private async persistOutboundMessage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    params: {
      conversationId: string;
      userId: string;
      waMessageId: string;
      body: string;
      aiGenerated: boolean;
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: params.conversationId,
        user_id: params.userId,
        wa_message_id: params.waMessageId,
        direction: "outbound",
        message_type: "text",
        body: params.body,
        status: "sent",
        ai_generated: params.aiGenerated,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Failed to persist outbound WhatsApp message: ${error?.message}`);
    }

    // Update conversation last_message_preview/last_message_at
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: params.body.slice(0, 200),
      })
      .eq("id", params.conversationId);

    return data.id as string;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function extractMessagePreview(message: WhatsAppIncomingMessage): string {
  switch (message.type) {
    case "text":
      return message.text?.body ?? "";
    case "image":
      return message.image?.caption ? `📷 ${message.image.caption}` : "📷 Image";
    case "video":
      return message.video?.caption ? `🎥 ${message.video.caption}` : "🎥 Video";
    case "audio":
      return "🎙️ Audio";
    case "document":
      return message.document?.filename ? `📎 ${message.document.filename}` : "📎 Document";
    case "sticker":
      return "🎨 Sticker";
    case "location":
      return message.location?.name ? `📍 ${message.location.name}` : "📍 Location";
    case "interactive":
      return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "Interactive";
    default:
      return "(message)";
  }
}

function appendSignatureIfPresent(reply: string | null, signatureSuffix: string): string | null {
  if (!reply?.trim()) return null;
  const trimmedSig = signatureSuffix.trim();
  if (!trimmedSig) return reply.trim();
  // Avoid double-appending if the model already included it.
  if (reply.includes(trimmedSig)) return reply.trim();
  return `${reply.trim()}\n${trimmedSig}`;
}

function isWithinBusinessHours(config: WhatsAppAutomationConfigRow): boolean {
  if (!config.business_hours_start || !config.business_hours_end) return true;
  try {
    const tz = config.business_hours_timezone || "UTC";
    const now = new Date();
    const nowParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const hour = Number(nowParts.find((p) => p.type === "hour")?.value);
    const minute = Number(nowParts.find((p) => p.type === "minute")?.value);
    const nowMinutes = hour * 60 + minute;

    const [startH, startM] = config.business_hours_start.split(":").map(Number);
    const [endH, endM] = config.business_hours_end.split(":").map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    // Handles ranges that don't cross midnight.
    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    // Crosses midnight: e.g. 22:00 → 06:00
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  } catch {
    return true; // If TZ parsing fails, fail-open rather than block replies.
  }
}
