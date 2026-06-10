// Always fetch fresh data — webhook delivers messages anytime.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ConversationList,
  type WhatsAppConversationSummary,
} from "@/components/whatsapp/conversation-list";
import {
  AutomationConfigForm,
  type WhatsAppAutomationConfig,
} from "@/components/whatsapp/automation-config-form";
import {
  DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
  DEFAULT_WHATSAPP_SYSTEM_PROMPT,
} from "@/services/platforms/whatsapp/whatsapp.constants";
import { MessageCircle } from "lucide-react";

interface CredentialsRow {
  is_active: boolean;
}

/**
 * Main WhatsApp dashboard. Server-renders:
 *   1. Credentials check (gates the whole page).
 *   2. Conversation list (latest incoming/outgoing messages).
 *   3. AI auto-reply config form.
 */
export default async function WhatsAppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <PageHeader />
        <p className="mt-6 text-sm text-text-muted">Sign in to use WhatsApp automation.</p>
      </div>
    );
  }

  // Check whether the user has saved WhatsApp credentials yet.
  const admin = createAdminClient();
  const { data: credsRow } = await admin
    .from("platform_credentials")
    .select("is_active")
    .eq("user_id", user.id)
    .eq("platform", "whatsapp")
    .maybeSingle<CredentialsRow>();

  if (!credsRow || !credsRow.is_active) {
    return (
      <div className="max-w-3xl">
        <PageHeader />
        <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-3">
            <MessageCircle size={22} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Connect WhatsApp Cloud API first
          </h3>
          <p className="mt-1 text-sm text-text-muted max-w-md">
            Paste your Meta Cloud API credentials in Settings, then come back here to configure the
            AI auto-reply bot.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  // Load conversations + automation config in parallel.
  const [conversationsRes, configRes] = await Promise.all([
    admin
      .from("whatsapp_conversations")
      .select(
        "id, contact_phone, contact_name, last_message_at, last_message_preview, unread_count, is_archived"
      )
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50),
    admin
      .from("whatsapp_automation_configs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const conversations = (conversationsRes.data ?? []) as WhatsAppConversationSummary[];

  const config: WhatsAppAutomationConfig = configRes.data
    ? (configRes.data as WhatsAppAutomationConfig)
    : {
        enabled: false,
        auto_reply: false,
        system_prompt: DEFAULT_WHATSAPP_SYSTEM_PROMPT,
        signature_suffix: DEFAULT_WHATSAPP_SIGNATURE_SUFFIX,
        business_hours_enabled: false,
        business_hours_start: null,
        business_hours_end: null,
        business_hours_timezone: "UTC",
        out_of_hours_message: null,
      };

  return (
    <div>
      <PageHeader />

      <div className="mt-6 grid gap-6 grid-cols-1 xl:grid-cols-2">
        <ConversationList conversations={conversations} />
        <AutomationConfigForm initialConfig={config} />
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
        WhatsApp Automation
      </h1>
      <p className="text-sm text-text-muted mt-1">
        AI auto-reply to customer messages via WhatsApp Cloud API
      </p>
    </div>
  );
}
