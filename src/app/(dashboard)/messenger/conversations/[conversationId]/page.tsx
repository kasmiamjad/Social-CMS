export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import {
  MessengerConversationThread,
  type MessengerConversationDetail,
  type MessengerMessageRow,
} from "@/components/messenger/conversation-thread";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function MessengerThreadPage({ params }: PageProps) {
  const { conversationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const tenantId = getTenantId();

  const { data: conversation } = await admin
    .from("messenger_conversations")
    .select("id, psid, contact_name, last_message_at, created_at, ai_paused")
    .eq("id", conversationId)
    .eq("user_id", tenantId)
    .maybeSingle<MessengerConversationDetail>();

  if (!conversation) notFound();

  const { data: messages } = await admin
    .from("messenger_messages")
    .select("id, mid, direction, message_type, body, media_url, status, ai_generated, sent_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <MessengerConversationThread
      conversation={conversation}
      messages={(messages ?? []) as MessengerMessageRow[]}
    />
  );
}
