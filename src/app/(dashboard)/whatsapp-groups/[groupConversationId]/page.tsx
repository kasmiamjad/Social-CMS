// Always fetch fresh data — new messages may have arrived.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import {
  GroupConversationThread,
  type WhatsAppGroupConversationDetail,
  type WhatsAppGroupMessageRow,
} from "@/components/whatsapp-groups/group-conversation-thread";

interface PageProps {
  params: Promise<{ groupConversationId: string }>;
}

export default async function GroupConversationThreadPage({ params }: PageProps) {
  const { groupConversationId } = await params;

  const admin = createAdminClient();
  const tenantId = getTenantId();

  const { data: conversation } = await admin
    .from("whatsapp_group_conversations")
    .select("id, group_jid, group_name, last_message_at, created_at")
    .eq("id", groupConversationId)
    .eq("user_id", tenantId)
    .maybeSingle<WhatsAppGroupConversationDetail>();

  if (!conversation) {
    notFound();
  }

  const { data: messages } = await admin
    .from("whatsapp_group_messages")
    .select("id, direction, message_type, sender_name, body, media_url, status, sent_at, created_at")
    .eq("group_conversation_id", groupConversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <GroupConversationThread
      conversation={conversation}
      messages={(messages ?? []) as WhatsAppGroupMessageRow[]}
    />
  );
}
