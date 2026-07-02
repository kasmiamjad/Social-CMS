import { createAdminClient } from "@/lib/supabase/admin";
import { generateOpenRouterJsonResponse } from "@/lib/openrouter";
import {
  InstagramEngagementService,
  InstagramEngagementApiError,
} from "@/services/platforms/instagram/instagram-engagement.service";
import {
  DEFAULT_INSTAGRAM_COMMENT_SYSTEM_PROMPT,
  DEFAULT_INSTAGRAM_DM_SYSTEM_PROMPT,
  DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
  INSTAGRAM_AI_JSON_CONTRACT,
} from "@/services/platforms/instagram/instagram-engagement.constants";
import type {
  InstagramAIDecision,
  InstagramCommentValue,
  InstagramDmMessage,
  InstagramMessagingEvent,
} from "@/services/platforms/instagram/instagram-engagement.types";

interface IgAutomationConfigRow {
  enabled: boolean;
  dms_enabled: boolean;
  dms_auto_reply: boolean;
  dms_system_prompt: string;
  comments_enabled: boolean;
  comments_auto_reply: boolean;
  comments_system_prompt: string;
  signature_suffix: string;
  business_hours_enabled: boolean;
  business_hours_start: string | null;
  business_hours_end: string | null;
  business_hours_timezone: string | null;
  out_of_hours_message: string | null;
}

interface PlatformCredentialsRow {
  credentials: {
    account_id?: string;
    access_token?: string;
    app_secret?: string;
    verify_token?: string;
    api_key?: string;
  };
}

interface IncomingDmContext {
  account_id: string;
  access_token: string;
  app_secret?: string;
  verify_token?: string;
}

/**
 * End-to-end orchestrator for Instagram DMs and comments:
 *   1. Upsert conversation / persist comment.
 *   2. Honour master + per-channel toggles + per-conversation ai_paused.
 *   3. Generate AI decision via OpenRouter.
 *   4. Send reply if auto_reply is on and AI decided yes.
 *   5. Store inbound + outbound rows in DB.
 */
export class InstagramEngagementAutoReplyService {
  /**
   * Process one inbound Instagram DM.
   */
  async processIncomingDm(
    userId: string,
    credentials: IncomingDmContext,
    event: InstagramMessagingEvent
  ): Promise<{
    conversationId: string;
    inboundMessageId: string | null;
    aiDecision: InstagramAIDecision | null;
    outboundMessageId: string | null;
    skippedReason: string | null;
  }> {
    const supabase = createAdminClient();
    const ig = new InstagramEngagementService(credentials);

    if (!event.message) {
      return {
        conversationId: "",
        inboundMessageId: null,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "non_message_event",
      };
    }

    // An echo is a message WE sent — from this portal OR from Instagram's own
    // inbox — coming back through the webhook. We store it as OUTBOUND (rather
    // than dropping it) so the thread mirrors both sides. For an echo the
    // "contact" is the recipient (the customer), not us.
    const isEcho = Boolean(event.message.is_echo);
    const contactIgId = isEcho ? event.recipient.id : event.sender.id;

    // Profile lookup only for inbound (the customer); echoes reuse the existing
    // conversation and must not overwrite the stored name with a blank.
    const profile = isEcho
      ? { username: null as string | null, name: null as string | null }
      : await ig.fetchUserProfile(contactIgId);

    const messagePreview = extractDmPreview(event.message);
    const { data: conversation, error: convError } = await supabase
      .from("instagram_dm_conversations")
      .upsert(
        {
          user_id: userId,
          contact_ig_id: contactIgId,
          // Only set name/username when we actually have them — never null out.
          ...(profile.username ? { contact_username: profile.username } : {}),
          ...(profile.name ? { contact_name: profile.name } : {}),
          last_message_at: new Date(event.timestamp).toISOString(),
          last_message_preview: messagePreview.slice(0, 200),
        },
        { onConflict: "user_id,contact_ig_id" }
      )
      .select("id, ai_paused")
      .single<{ id: string; ai_paused: boolean }>();

    if (convError || !conversation) {
      throw new Error(`Failed to upsert IG DM conversation: ${convError?.message}`);
    }

    // Persist the message (inbound customer msg, or outbound echo). Dedup on the
    // unique ig_message_id — an echo of a portal-sent reply is skipped.
    const messageType = inferDmType(event.message);
    const { data: inbound, error: inboundError } = await supabase
      .from("instagram_dm_messages")
      .insert({
        conversation_id: conversation.id,
        user_id: userId,
        ig_message_id: event.message.mid,
        direction: isEcho ? "outbound" : "inbound",
        message_type: messageType,
        body: messagePreview || null,
        status: isEcho ? "sent" : "received",
        raw_payload: event,
        sent_at: new Date(event.timestamp).toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    if (inboundError || !inbound) {
      if (inboundError?.code === "23505") {
        return {
          conversationId: conversation.id,
          inboundMessageId: "duplicate",
          aiDecision: null,
          outboundMessageId: null,
          skippedReason: "duplicate_webhook",
        };
      }
      throw new Error(`Failed to persist IG DM: ${inboundError?.message}`);
    }

    // Echoes stop here — they're our own outbound; no lead, no seen, no AI.
    if (isEcho) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "outbound_echo_stored",
      };
    }

    // Surface this DM as a lead so all channels land in one Leads pipeline
    // (mirrors WhatsApp/Messenger). Best-effort — never block the DM flow.
    try {
      await this.ensureLeadForDm(supabase, userId, conversation.id, {
        username: profile.username ?? null,
        name: profile.name ?? null,
        igId: contactIgId,
        preview: messagePreview,
      });
    } catch (err) {
      console.error("IG DM ensureLead failed", { userId, conversationId: conversation.id, err });
    }

    // Mark as seen (best-effort)
    try {
      await ig.markSeen(contactIgId);
    } catch (err) {
      console.warn("Failed to mark IG DM seen", { mid: event.message.mid, err });
    }

    // Per-conversation pause short-circuit
    if (conversation.ai_paused) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "ai_paused_for_conversation",
      };
    }

    // Load automation config
    const config = await this.getConfig(userId);
    if (!config.enabled) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "automation_disabled",
      };
    }
    if (!config.dms_enabled) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "dms_disabled",
      };
    }
    if (!config.dms_auto_reply) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "dms_auto_reply_disabled",
      };
    }

    // Business hours check
    if (config.business_hours_enabled && !isWithinBusinessHours(config)) {
      if (config.out_of_hours_message?.trim()) {
        try {
          const sent = await ig.sendTextDm(contactIgId, config.out_of_hours_message);
          await this.persistOutboundDm(supabase, {
            conversationId: conversation.id,
            userId,
            igMessageId: sent.messageId,
            body: config.out_of_hours_message,
            aiGenerated: false,
          });
        } catch (err) {
          console.error("Failed to send IG out-of-hours DM", err);
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

    // Generate AI decision (only for text DMs for now)
    if (messageType !== "text" || !event.message.text?.trim()) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: null,
        outboundMessageId: null,
        skippedReason: "non_text_dm",
      };
    }

    const apiKey = await this.getOpenRouterApiKey(userId);
    const history = await this.fetchDmHistory(conversation.id, inbound.id);
    const decision = await this.getAIDecisionForDm(
      config.dms_system_prompt || DEFAULT_INSTAGRAM_DM_SYSTEM_PROMPT,
      profile.username ?? "",
      profile.name ?? "",
      event.message.text,
      config.signature_suffix || DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
      history,
      apiKey
    );

    if (!decision.should_reply || !decision.reply?.trim()) {
      return {
        conversationId: conversation.id,
        inboundMessageId: inbound.id,
        aiDecision: decision,
        outboundMessageId: null,
        skippedReason: "ai_decided_skip",
      };
    }

    // Send the AI reply
    try {
      const sent = await ig.sendTextDm(contactIgId, decision.reply);
      const outboundId = await this.persistOutboundDm(supabase, {
        conversationId: conversation.id,
        userId,
        igMessageId: sent.messageId,
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
      const reason = err instanceof InstagramEngagementApiError ? err.message : "send_failed";
      console.error("Failed to send IG AI DM reply", { contactIgId, err });
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
   * Process one inbound Instagram comment event.
   */
  async processIncomingComment(
    userId: string,
    credentials: IncomingDmContext,
    value: InstagramCommentValue
  ): Promise<{
    commentId: string;
    aiDecision: InstagramAIDecision | null;
    posted: boolean;
    skippedReason: string | null;
  }> {
    const supabase = createAdminClient();
    const ig = new InstagramEngagementService(credentials);

    const igCommentId = value.id || value.comment_id || "";
    if (!igCommentId) {
      return {
        commentId: "",
        aiDecision: null,
        posted: false,
        skippedReason: "missing_comment_id",
      };
    }

    // Persist the comment (or skip if duplicate)
    const { data: row, error: insertError } = await supabase
      .from("instagram_comments")
      .insert({
        user_id: userId,
        ig_media_id: value.media?.id ?? "",
        ig_comment_id: igCommentId,
        parent_comment_id: value.parent_id ?? null,
        author_ig_id: value.from?.id ?? null,
        author_username: value.from?.username ?? null,
        comment_text: value.text,
        status: "pending_review",
        raw_payload: value,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError) {
      if (insertError.code === "23505") {
        return {
          commentId: igCommentId,
          aiDecision: null,
          posted: false,
          skippedReason: "duplicate_comment",
        };
      }
      throw new Error(`Failed to persist IG comment: ${insertError.message}`);
    }

    // Load automation config
    const config = await this.getConfig(userId);
    if (!config.enabled || !config.comments_enabled) {
      await supabase
        .from("instagram_comments")
        .update({ status: "skipped" })
        .eq("id", row!.id);
      return {
        commentId: igCommentId,
        aiDecision: null,
        posted: false,
        skippedReason: !config.enabled ? "automation_disabled" : "comments_disabled",
      };
    }

    // Generate AI decision
    const apiKey = await this.getOpenRouterApiKey(userId);
    const decision = await this.getAIDecisionForComment(
      config.comments_system_prompt || DEFAULT_INSTAGRAM_COMMENT_SYSTEM_PROMPT,
      value.text,
      value.from?.username ?? "",
      config.signature_suffix || DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
      apiKey
    );

    if (!decision.should_reply || !decision.reply?.trim()) {
      await supabase
        .from("instagram_comments")
        .update({
          status: "skipped",
          ai_reply: decision.reply,
        })
        .eq("id", row!.id);
      return {
        commentId: igCommentId,
        aiDecision: decision,
        posted: false,
        skippedReason: "ai_decided_skip",
      };
    }

    // Auto-post if enabled
    if (!config.comments_auto_reply) {
      await supabase
        .from("instagram_comments")
        .update({
          status: "pending_review",
          ai_reply: decision.reply,
        })
        .eq("id", row!.id);
      return {
        commentId: igCommentId,
        aiDecision: decision,
        posted: false,
        skippedReason: "auto_reply_disabled",
      };
    }

    try {
      await ig.replyToComment(igCommentId, decision.reply);
      await supabase
        .from("instagram_comments")
        .update({
          status: "posted",
          ai_reply: decision.reply,
          posted_at: new Date().toISOString(),
        })
        .eq("id", row!.id);
      return {
        commentId: igCommentId,
        aiDecision: decision,
        posted: true,
        skippedReason: null,
      };
    } catch (err) {
      const errMsg = err instanceof InstagramEngagementApiError ? err.message : String(err);
      console.error("Failed to post IG comment reply", { igCommentId, err });
      await supabase
        .from("instagram_comments")
        .update({
          status: "failed",
          status_error: errMsg.slice(0, 500),
          ai_reply: decision.reply,
        })
        .eq("id", row!.id);
      return {
        commentId: igCommentId,
        aiDecision: decision,
        posted: false,
        skippedReason: errMsg,
      };
    }
  }

  // ── Internal helpers ───────────────────────────────────────────────

  /**
   * Ensures an Instagram DM has a corresponding lead (created once per
   * conversation), so it appears in the shared Leads pipeline alongside
   * WhatsApp and Messenger. No-op if a lead already links this conversation.
   */
  private async ensureLeadForDm(
    supabase: ReturnType<typeof createAdminClient>,
    userId: string,
    conversationId: string,
    contact: { username: string | null; name: string | null; igId: string; preview: string }
  ): Promise<void> {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .eq("instagram_conversation_id", conversationId)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing) return;

    const { data: nextNoData } = await supabase
      .rpc("next_lead_serial_no", { p_user_id: userId })
      .single<number>();
    const serial_no = typeof nextNoData === "number" ? nextNoData : 1;

    const clientName =
      contact.name?.trim() ||
      (contact.username ? `@${contact.username}` : `Instagram ${contact.igId.slice(-6)}`);

    await supabase.from("leads").insert({
      user_id: userId,
      serial_no,
      client_name: clientName,
      status: "new",
      source: "instagram",
      instagram_conversation_id: conversationId,
      remarks: contact.preview?.slice(0, 200) || null,
    });
  }

  private async getConfig(userId: string): Promise<IgAutomationConfigRow> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("instagram_automation_configs")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<IgAutomationConfigRow>();

    return (
      data ?? {
        enabled: false,
        dms_enabled: false,
        dms_auto_reply: false,
        dms_system_prompt: DEFAULT_INSTAGRAM_DM_SYSTEM_PROMPT,
        comments_enabled: false,
        comments_auto_reply: false,
        comments_system_prompt: DEFAULT_INSTAGRAM_COMMENT_SYSTEM_PROMPT,
        signature_suffix: DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
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
   * Fetches the last N messages of an IG DM conversation as LLM history.
   * Excludes the just-inserted inbound message.
   */
  private async fetchDmHistory(
    conversationId: string,
    currentInboundId: string,
    limit: number = 30
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("instagram_dm_messages")
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

  private async getAIDecisionForDm(
    systemPrompt: string,
    contactUsername: string,
    contactName: string,
    message: string,
    signatureSuffix: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    apiKey?: string
  ): Promise<InstagramAIDecision> {
    const model =
      process.env.LLM_MODEL ??
      process.env.OPENROUTER_CLAUDE_MODEL ??
      "gpt-4o-mini";
    const fullSystemPrompt = systemPrompt.trimEnd() + INSTAGRAM_AI_JSON_CONTRACT;

    const decision = await generateOpenRouterJsonResponse<InstagramAIDecision>({
      model,
      systemPrompt: fullSystemPrompt,
      apiKey,
      history,
      userMessage: JSON.stringify({
        contact_username: contactUsername,
        contact_name: contactName,
        message,
      }),
    });

    return {
      should_reply: Boolean(decision.should_reply),
      reply: appendSignatureIfPresent(decision.reply, signatureSuffix),
      intent: decision.intent ?? null,
    };
  }

  private async getAIDecisionForComment(
    systemPrompt: string,
    commentText: string,
    authorUsername: string,
    signatureSuffix: string,
    apiKey?: string
  ): Promise<InstagramAIDecision> {
    const model =
      process.env.LLM_MODEL ??
      process.env.OPENROUTER_CLAUDE_MODEL ??
      "gpt-4o-mini";
    const fullSystemPrompt = systemPrompt.trimEnd() + INSTAGRAM_AI_JSON_CONTRACT;

    const decision = await generateOpenRouterJsonResponse<InstagramAIDecision>({
      model,
      systemPrompt: fullSystemPrompt,
      apiKey,
      userMessage: JSON.stringify({
        comment_text: commentText,
        author_username: authorUsername,
        post_caption: "",
      }),
    });

    return {
      should_reply: Boolean(decision.should_reply),
      reply: appendSignatureIfPresent(decision.reply, signatureSuffix),
      intent: decision.intent ?? null,
    };
  }

  private async persistOutboundDm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    params: {
      conversationId: string;
      userId: string;
      igMessageId: string;
      body: string;
      aiGenerated: boolean;
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from("instagram_dm_messages")
      .insert({
        conversation_id: params.conversationId,
        user_id: params.userId,
        ig_message_id: params.igMessageId || null,
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
      throw new Error(`Failed to persist outbound IG DM: ${error?.message}`);
    }

    await supabase
      .from("instagram_dm_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: params.body.slice(0, 200),
      })
      .eq("id", params.conversationId);

    return data.id as string;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractDmPreview(message: InstagramDmMessage): string {
  if (message.text) return message.text;
  if (message.attachments?.length) {
    const att = message.attachments[0];
    switch (att.type) {
      case "image": return "📷 Image";
      case "video": return "🎥 Video";
      case "audio": return "🎙️ Audio";
      case "story_mention": return "📲 Story mention";
      case "share": return "🔁 Shared post";
      default: return "(attachment)";
    }
  }
  return "(message)";
}

function inferDmType(message: InstagramDmMessage): string {
  if (message.text) return "text";
  const att = message.attachments?.[0];
  if (!att) return "unsupported";
  if (att.type === "image") return "image";
  if (att.type === "video") return "video";
  if (att.type === "audio") return "audio";
  if (att.type === "story_mention") return "story_reply";
  if (att.type === "share") return "share";
  return "unsupported";
}

function appendSignatureIfPresent(reply: string | null, signatureSuffix: string): string | null {
  if (!reply?.trim()) return null;
  const trimmedSig = signatureSuffix.trim();
  if (!trimmedSig) return reply.trim();
  if (reply.includes(trimmedSig)) return reply.trim();
  return `${reply.trim()}\n${trimmedSig}`;
}

function isWithinBusinessHours(config: IgAutomationConfigRow): boolean {
  if (!config.business_hours_start || !config.business_hours_end) return true;
  try {
    const tz = config.business_hours_timezone || "UTC";
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    const nowMinutes = hour * 60 + minute;
    const [startH, startM] = config.business_hours_start.split(":").map(Number);
    const [endH, endM] = config.business_hours_end.split(":").map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);
    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  } catch {
    return true;
  }
}
