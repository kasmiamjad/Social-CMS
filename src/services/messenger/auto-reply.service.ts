import { createAdminClient } from "@/lib/supabase/admin";
import { generateOpenRouterJsonResponse } from "@/lib/openrouter";
import { MessengerService, MessengerApiError } from "@/services/platforms/messenger/messenger.service";
import {
  DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
  DEFAULT_WHATSAPP_SYSTEM_PROMPT,
  WHATSAPP_AI_JSON_CONTRACT,
} from "@/services/platforms/whatsapp/whatsapp.constants";
import type { WhatsAppAIDecision } from "@/services/platforms/whatsapp/whatsapp.types";
import type {
  MessengerCredentials,
  MessengerMessagingEvent,
} from "@/services/platforms/messenger/messenger.types";

interface AutomationConfigRow {
  enabled: boolean;
  auto_reply: boolean;
  system_prompt: string;
  signature_suffix: string;
}

interface PlatformCredentialsRow {
  credentials: { api_key?: string };
}

/**
 * Handles an incoming Facebook Messenger event end-to-end (store → AI reply →
 * lead). Mirrors WhatsAppAutoReplyService but writes to the messenger_* tables
 * and reuses the same SA'DA system prompt + automation config.
 *
 * v1 is text-only: image attachments are stored but the bot replies in text.
 */
export class MessengerAutoReplyService {
  async processIncomingMessage(
    userId: string,
    credentials: MessengerCredentials,
    event: MessengerMessagingEvent
  ): Promise<{ conversationId: string | null; skippedReason: string | null }> {
    // Ignore echoes (messages the Page itself sent) and events without a message.
    if (event.message?.is_echo || !event.message) {
      return { conversationId: null, skippedReason: "not_an_inbound_message" };
    }

    const supabase = createAdminClient();
    const messenger = new MessengerService(credentials);

    const psid = event.sender.id;
    const messageText = event.message.text ?? "";
    const messageType = event.message.attachments?.[0]?.type ?? "text";
    const mediaUrl = event.message.attachments?.[0]?.payload?.url ?? null;
    const preview = messageText || (mediaUrl ? `📎 ${messageType}` : "(message)");

    // 1. Upsert conversation
    const { data: conversation, error: convError } = await supabase
      .from("messenger_conversations")
      .upsert(
        {
          user_id: userId,
          page_id: event.recipient.id,
          psid,
          last_message_at: new Date(event.timestamp).toISOString(),
          last_message_preview: preview.slice(0, 200),
        },
        { onConflict: "user_id,psid" }
      )
      .select("id, contact_name, ai_paused")
      .single<{ id: string; contact_name: string | null; ai_paused: boolean }>();

    if (convError || !conversation) {
      throw new Error(`Failed to upsert messenger conversation: ${convError?.message}`);
    }

    // 2. Persist inbound message (dedupe on mid)
    const { error: inboundError } = await supabase.from("messenger_messages").insert({
      conversation_id: conversation.id,
      user_id: userId,
      mid: event.message.mid,
      direction: "inbound",
      message_type: normalizeType(messageType),
      body: messageText || null,
      media_url: mediaUrl,
      status: "received",
      raw_payload: event,
      sent_at: new Date(event.timestamp).toISOString(),
    });

    if (inboundError) {
      if (inboundError.code === "23505") {
        return { conversationId: conversation.id, skippedReason: "duplicate_webhook" };
      }
      throw new Error(`Failed to persist inbound messenger message: ${inboundError.message}`);
    }

    // 2a. Backfill the contact name once (best-effort).
    if (!conversation.contact_name) {
      const profile = await messenger.getUserProfile(psid);
      if (profile?.name) {
        await supabase
          .from("messenger_conversations")
          .update({ contact_name: profile.name })
          .eq("id", conversation.id);
        conversation.contact_name = profile.name;
      }
    }

    // Ensure every inbound conversation has a lead (status 'new', source
    // 'facebook') so all Messenger chats appear in the Leads list immediately.
    try {
      await this.ensureLeadForConversation(userId, conversation.id, conversation.contact_name, psid, preview);
    } catch (err) {
      console.error("ensureLeadForConversation (Messenger) failed", err);
    }

    // 3. Short-circuit: paused conversation or disabled automation.
    if (conversation.ai_paused) {
      return { conversationId: conversation.id, skippedReason: "ai_paused_for_conversation" };
    }
    const config = await this.getConfig(userId);
    if (!config.enabled || !config.auto_reply) {
      return {
        conversationId: conversation.id,
        skippedReason: !config.enabled ? "automation_disabled" : "auto_reply_disabled",
      };
    }

    // 4. Only text messages get an AI reply (attachments are stored only).
    if (!messageText.trim()) {
      return { conversationId: conversation.id, skippedReason: "non_text_message" };
    }

    // 5. Generate + send the reply.
    const apiKey = await this.getOpenRouterApiKey(userId);
    const history = await this.fetchHistory(conversation.id, event.message.mid);
    const decision = await this.getAIDecision(
      config.system_prompt || DEFAULT_WHATSAPP_SYSTEM_PROMPT,
      conversation.contact_name,
      messageText,
      config.signature_suffix || DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
      history,
      apiKey
    );

    const replyText = decision.reply?.trim() ?? "";
    if (!decision.should_reply || !replyText) {
      return { conversationId: conversation.id, skippedReason: "ai_decided_skip" };
    }
    // Suppress junk single-character replies.
    if (replyText.length <= 2 && !/^(ok|hi)$/i.test(replyText)) {
      return { conversationId: conversation.id, skippedReason: "junk_reply_suppressed" };
    }

    try {
      const sent = await messenger.sendTextMessage(psid, replyText);
      await this.persistOutbound(supabase, conversation.id, userId, sent.messageId, replyText);

      const looksLikeSummary = /our team will (contact|reach out|get in touch)/i.test(replyText);
      if (decision.lead_ready === true || looksLikeSummary) {
        try {
          await this.maybeCreateLead(
            userId,
            conversation.id,
            conversation.contact_name,
            psid,
            decision.lead_data ?? {}
          );
        } catch (leadErr) {
          console.error("Messenger auto-create lead FAILED", {
            conversationId: conversation.id,
            err: leadErr instanceof Error ? leadErr.message : leadErr,
          });
        }
      }

      return { conversationId: conversation.id, skippedReason: null };
    } catch (err) {
      const reason = err instanceof MessengerApiError ? err.message : "send_failed";
      console.error("Failed to send Messenger AI reply", { psid, err });
      return { conversationId: conversation.id, skippedReason: reason };
    }
  }

  /**
   * Creates a 'new' lead for a Messenger conversation on its first inbound
   * message, if one doesn't already exist. Later qualification fills details.
   */
  private async ensureLeadForConversation(
    userId: string,
    conversationId: string,
    contactName: string | null,
    psid: string,
    preview: string
  ): Promise<void> {
    const supabase = createAdminClient();
    const resolvedName = contactName?.trim() || null;
    const fallbackName = `Messenger ${psid.slice(-6)}`;

    const { data: existing } = await supabase
      .from("leads")
      .select("id, client_name")
      .eq("user_id", userId)
      .eq("messenger_conversation_id", conversationId)
      .limit(1)
      .maybeSingle<{ id: string; client_name: string | null }>();

    if (existing) {
      // Backfill the real name over the "Messenger <id>" fallback once the
      // profile lookup resolves it (e.g. after Advanced Access is granted).
      if (resolvedName && /^Messenger \S+$/.test(existing.client_name ?? "")) {
        await supabase.from("leads").update({ client_name: resolvedName }).eq("id", existing.id);
      }
      return;
    }

    const { data: nextNoData } = await supabase
      .rpc("next_lead_serial_no", { p_user_id: userId })
      .single<number>();
    const serial_no = typeof nextNoData === "number" ? nextNoData : 1;

    await supabase.from("leads").insert({
      user_id: userId,
      serial_no,
      client_name: resolvedName || fallbackName,
      status: "new",
      source: "facebook",
      messenger_conversation_id: conversationId,
      remarks: preview?.slice(0, 200) || null,
    });
  }

  /**
   * Creates or fills in a lead from the AI's extracted data, linked to this
   * Messenger conversation. Messenger contacts have no phone, so client_phone
   * stays null and the PSID lives in the linkage.
   */
  private async maybeCreateLead(
    userId: string,
    conversationId: string,
    contactName: string | null,
    psid: string,
    leadData: {
      client_name?: string | null;
      business_type?: string | null;
      location_text?: string | null;
      product_model?: string | null;
      product_qty?: number | null;
      remarks?: string | null;
    }
  ): Promise<void> {
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .eq("messenger_conversation_id", conversationId)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existing) {
      const update: Record<string, unknown> = { status: "qualified" };
      if (leadData.business_type) update.client_business_type = leadData.business_type;
      if (leadData.location_text) update.location_address = leadData.location_text;
      if (leadData.product_model) update.product_model = leadData.product_model;
      if (typeof leadData.product_qty === "number") update.product_qty = leadData.product_qty;
      if (leadData.remarks) update.remarks = leadData.remarks;
      await supabase.from("leads").update(update).eq("id", existing.id);
      return;
    }

    const { data: nextNoData } = await supabase
      .rpc("next_lead_serial_no", { p_user_id: userId })
      .single<number>();
    const serial_no = typeof nextNoData === "number" ? nextNoData : 1;

    await supabase.from("leads").insert({
      user_id: userId,
      serial_no,
      client_name: leadData.client_name?.trim() || contactName?.trim() || `Messenger ${psid.slice(-6)}`,
      client_business_type: leadData.business_type ?? null,
      product_qty: leadData.product_qty ?? 1,
      product_model: leadData.product_model ?? null,
      location_address: leadData.location_text ?? null,
      status: "qualified",
      source: "facebook",
      messenger_conversation_id: conversationId,
      remarks: leadData.remarks ?? null,
    });
  }

  private async getConfig(userId: string): Promise<AutomationConfigRow> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("whatsapp_automation_configs")
      .select("enabled, auto_reply, system_prompt, signature_suffix")
      .eq("user_id", userId)
      .maybeSingle<AutomationConfigRow>();

    return (
      data ?? {
        enabled: false,
        auto_reply: false,
        system_prompt: DEFAULT_WHATSAPP_SYSTEM_PROMPT,
        signature_suffix: DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
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

  private async fetchHistory(
    conversationId: string,
    currentMid: string,
    limit = 15
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("messenger_messages")
      .select("mid, direction, body")
      .eq("conversation_id", conversationId)
      .neq("mid", currentMid)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (!data) return [];
    return (data as Array<{ direction: string; body: string | null }>)
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
    const model =
      process.env.LLM_MODEL ?? process.env.OPENROUTER_CLAUDE_MODEL ?? "gpt-4o-mini";
    const fullSystemPrompt = systemPrompt.trimEnd() + WHATSAPP_AI_JSON_CONTRACT;

    const decision = await generateOpenRouterJsonResponse<WhatsAppAIDecision>({
      model,
      systemPrompt: fullSystemPrompt,
      apiKey,
      history,
      userMessage: JSON.stringify({ contact_name: contactName ?? "", message }),
    });

    const trimmedSig = signatureSuffix.trim();
    let reply = decision.reply?.trim() ?? null;
    if (reply && trimmedSig && !reply.includes(trimmedSig)) {
      reply = `${reply}\n${trimmedSig}`;
    }

    return {
      should_reply: Boolean(decision.should_reply),
      reply,
      intent: decision.intent ?? null,
      lead_ready: decision.lead_ready ?? false,
      lead_data: decision.lead_data ?? {},
      images_to_send: [],
    };
  }

  private async persistOutbound(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    conversationId: string,
    userId: string,
    mid: string,
    body: string
  ): Promise<void> {
    await supabase.from("messenger_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      mid,
      direction: "outbound",
      message_type: "text",
      body,
      status: "sent",
      ai_generated: true,
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from("messenger_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 200),
      })
      .eq("id", conversationId);
  }
}

/** Maps a Messenger attachment type to our messenger_messages.message_type enum. */
function normalizeType(type: string): string {
  const allowed = ["text", "image", "audio", "video", "file", "sticker", "location", "postback", "fallback"];
  return allowed.includes(type) ? type : "fallback";
}
