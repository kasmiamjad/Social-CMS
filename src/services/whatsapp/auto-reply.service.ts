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

      // Auto-create lead when AI says the qualification is complete.
      // We accept two signals:
      //   1. Explicit lead_ready=true in the AI's JSON response (the cleanest)
      //   2. Fallback heuristic — the reply contains the summary phrase
      //      "team will contact you" (in case the AI forgot the JSON flag
      //      but still sent the right reply text)
      const replyText = decision.reply ?? "";
      const replyLooksLikeSummary =
        /our team will contact you/i.test(replyText) ||
        /our team will reach out/i.test(replyText) ||
        /team will get in touch/i.test(replyText);
      const shouldCreateLead =
        decision.lead_ready === true || replyLooksLikeSummary;

      // Always log what we got so debugging is easy from pm2 logs
      console.log("WhatsApp AI decision summary", {
        conversationId: conversation.id,
        contactPhone,
        shouldCreateLead,
        lead_ready_flag: decision.lead_ready,
        reply_matches_summary_pattern: replyLooksLikeSummary,
        has_lead_data: !!decision.lead_data,
        lead_data: decision.lead_data,
      });

      if (shouldCreateLead) {
        try {
          await this.maybeCreateLeadFromAI(
            userId,
            conversation.id,
            contactPhone,
            contactName,
            decision.lead_data ?? {},
            replyText
          );
          console.log("Auto-create lead succeeded", {
            conversationId: conversation.id,
          });
        } catch (leadErr) {
          // Don't fail the reply just because lead creation failed
          console.error("Auto-create lead FAILED", {
            conversationId: conversation.id,
            err: leadErr instanceof Error ? leadErr.message : leadErr,
          });
        }
      }

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
   * Auto-creates (or updates) a lead row from the AI's extracted lead_data
   * when the qualification flow is complete. If a lead already exists for
   * this conversation, fills in any missing fields without overwriting
   * data the operator may have already corrected manually.
   */
  private async maybeCreateLeadFromAI(
    userId: string,
    conversationId: string,
    contactPhone: string,
    contactName: string | null,
    leadData: {
      client_name?: string | null;
      business_type?: string | null;
      location_text?: string | null;
      product_model?: string | null;
      product_qty?: number | null;
      remarks?: string | null;
    },
    replyText: string = ""
  ): Promise<void> {
    const supabase = createAdminClient();

    // If lead_data is missing fields, try to extract them from the AI's summary
    // text using simple heuristics (the AI usually mentions the model + qty +
    // location right in the reply).
    if (!leadData.product_model) {
      const modelMatch = replyText.match(
        /\*?(7-Stage Smart RO|6-Stage Smart RO|7-Stage RO \+ UV|7-Stage RO|Dispenser \(Hot\/Cold\))\*?/i
      );
      if (modelMatch) leadData.product_model = modelMatch[1];
    }
    if (!leadData.product_qty) {
      const qtyMatch = replyText.match(/×\s*(\d+)/);
      if (qtyMatch) leadData.product_qty = parseInt(qtyMatch[1], 10);
    }
    if (!leadData.business_type) {
      const lowered = replyText.toLowerCase();
      if (/for your home|for home|residential/.test(lowered)) leadData.business_type = "Home / Residential";
      else if (/coffee shop/.test(lowered)) leadData.business_type = "Coffee shop";
      else if (/restaurant/.test(lowered)) leadData.business_type = "Restaurant";
      else if (/office/.test(lowered)) leadData.business_type = "Office";
      else if (/hotel/.test(lowered)) leadData.business_type = "Hotel";
    }
    if (!leadData.location_text) {
      // Pattern: "in <CITY>" or "in <PLACE>" in the summary
      const locMatch = replyText.match(/(?:in|at)\s+([A-Z][\wÀ-ÿ\s'.-]+?)(?:[•\n.!?]|$)/);
      if (locMatch) leadData.location_text = locMatch[1].trim();
    }

    // Look for a Google Maps URL in the conversation's location messages
    // — the AI doesn't see the raw payload, only "📍 Location" placeholders.
    let googleMapsUrl: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    const { data: locationRows } = await supabase
      .from("whatsapp_messages")
      .select("raw_payload")
      .eq("conversation_id", conversationId)
      .eq("message_type", "location")
      .order("created_at", { ascending: false })
      .limit(1);

    if (locationRows && locationRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = locationRows[0].raw_payload as any;
      const loc = payload?.location;
      if (loc) {
        if (typeof loc.latitude === "number") lat = loc.latitude;
        if (typeof loc.longitude === "number") lng = loc.longitude;
        if (lat !== null && lng !== null) {
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }
      }
    }

    // Does a lead for this conversation already exist?
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .eq("whatsapp_conversation_id", conversationId)
      .limit(1)
      .maybeSingle<{ id: string }>();

    const clientName =
      leadData.client_name?.trim() ||
      contactName?.trim() ||
      contactPhone;

    if (existing) {
      // Update only fields that are still empty (don't clobber operator edits)
      const updatePayload: Record<string, unknown> = {};
      if (leadData.business_type) updatePayload.client_business_type = leadData.business_type;
      if (leadData.location_text) updatePayload.location_address = leadData.location_text;
      if (leadData.product_model) updatePayload.product_model = leadData.product_model;
      if (typeof leadData.product_qty === "number") updatePayload.product_qty = leadData.product_qty;
      if (leadData.remarks) updatePayload.remarks = leadData.remarks;
      if (googleMapsUrl) updatePayload.location_url = googleMapsUrl;
      if (lat !== null) updatePayload.location_lat = lat;
      if (lng !== null) updatePayload.location_lng = lng;
      updatePayload.status = "qualified";

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from("leads")
          .update(updatePayload)
          .eq("id", existing.id);
      }
      return;
    }

    // Create new lead
    const { data: nextNoData } = await supabase
      .rpc("next_lead_serial_no", { p_user_id: userId })
      .single<number>();
    const serial_no = typeof nextNoData === "number" ? nextNoData : 1;

    await supabase.from("leads").insert({
      user_id: userId,
      serial_no,
      client_name: clientName,
      client_phone: contactPhone,
      client_business_type: leadData.business_type ?? null,
      product_qty: leadData.product_qty ?? 1,
      product_model: leadData.product_model ?? null,
      location_address: leadData.location_text ?? null,
      location_url: googleMapsUrl,
      location_lat: lat,
      location_lng: lng,
      status: "qualified",
      source: "whatsapp_ai",
      whatsapp_conversation_id: conversationId,
      remarks: leadData.remarks ?? null,
    });
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
