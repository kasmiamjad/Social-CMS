export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import {
  InstagramConversationThread,
  type InstagramConversationDetail,
  type InstagramMessageRow,
} from "@/components/instagram/conversation-thread";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function InstagramThreadPage({ params }: PageProps) {
  const { conversationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const tenantId = getTenantId();

  const { data: conversation } = await admin
    .from("instagram_dm_conversations")
    .select("id, contact_ig_id, contact_username, contact_name, last_message_at, created_at, ai_paused")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<InstagramConversationDetail>();

  if (!conversation) notFound();

  const { data: messages } = await admin
    .from("instagram_dm_messages")
    .select("id, ig_message_id, direction, message_type, body, media_url, status, ai_generated, sent_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <InstagramConversationThread
      conversation={conversation}
      messages={(messages ?? []) as InstagramMessageRow[]}
    />
  );
}
