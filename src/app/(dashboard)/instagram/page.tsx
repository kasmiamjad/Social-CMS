export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  InstagramDmConversationList,
  type InstagramDmConversationSummary,
} from "@/components/instagram/dm-conversation-list";
import {
  InstagramCommentsList,
  type InstagramCommentSummary,
} from "@/components/instagram/comments-list";
import {
  InstagramAutomationConfigForm,
  type InstagramAutomationConfig,
} from "@/components/instagram/automation-config-form";
import {
  DEFAULT_INSTAGRAM_COMMENT_SYSTEM_PROMPT,
  DEFAULT_INSTAGRAM_DM_SYSTEM_PROMPT,
  DEFAULT_INSTAGRAM_SIGNATURE_SUFFIX,
} from "@/services/platforms/instagram/instagram-engagement.constants";
import { Camera } from "lucide-react";

interface CredentialsRow {
  is_active: boolean;
  credentials: { account_id?: string };
}

export default async function InstagramEngagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <PageHeader />
        <p className="mt-6 text-sm text-text-muted">Sign in to use Instagram automation.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: credsRow } = await admin
    .from("platform_credentials")
    .select("is_active, credentials")
    .eq("user_id", user.id)
    .eq("platform", "instagram")
    .maybeSingle<CredentialsRow>();

  if (!credsRow || !credsRow.is_active || !credsRow.credentials?.account_id) {
    return (
      <div className="max-w-3xl">
        <PageHeader />
        <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-3">
            <Camera size={22} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Connect Instagram first
          </h3>
          <p className="mt-1 text-sm text-text-muted max-w-md">
            Paste your Instagram Business Account ID + Access Token (plus App ID, App Secret, and
            a Verify Token for webhooks) in Settings, then come back here.
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

  const [dmsRes, commentsRes, configRes] = await Promise.all([
    admin
      .from("instagram_dm_conversations")
      .select("id, contact_ig_id, contact_username, contact_name, last_message_at, last_message_preview, unread_count, is_archived, ai_paused")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50),
    admin
      .from("instagram_comments")
      .select("id, ig_media_id, ig_comment_id, author_username, comment_text, ai_reply, status, status_error, posted_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("instagram_automation_configs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const dms = (dmsRes.data ?? []) as InstagramDmConversationSummary[];
  const comments = (commentsRes.data ?? []) as InstagramCommentSummary[];

  const config: InstagramAutomationConfig = configRes.data
    ? (configRes.data as InstagramAutomationConfig)
    : {
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
        business_hours_timezone: "UTC",
        out_of_hours_message: null,
      };

  return (
    <div>
      <PageHeader />
      <div className="mt-6 grid gap-6 grid-cols-1 xl:grid-cols-2">
        <div className="space-y-6">
          <InstagramDmConversationList conversations={dms} />
          <InstagramCommentsList comments={comments} />
        </div>
        <InstagramAutomationConfigForm initialConfig={config} />
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
        Instagram Automation
      </h1>
      <p className="text-sm text-text-muted mt-1">
        AI auto-reply to Instagram DMs and comments
      </p>
    </div>
  );
}
