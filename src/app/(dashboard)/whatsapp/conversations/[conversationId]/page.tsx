// Always fetch fresh data — new messages may have arrived.
export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ConversationThread,
  type WhatsAppConversationDetail,
  type WhatsAppMessageRow,
} from "@/components/whatsapp/conversation-thread";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

/**
 * Single-conversation thread view. Fetches the conversation + all messages
 * (verifying the conversation belongs to the authenticated user) and renders
 * them in a chat-bubble layout.
 */
export default async function ConversationThreadPage({ params }: PageProps) {
  const { conversationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // Load conversation — scoped to current user for security.
  const { data: conversation } = await admin
    .from("whatsapp_conversations")
    .select(
      "id, contact_phone, contact_name, last_message_at, created_at, ai_paused"
    )
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle<WhatsAppConversationDetail>();

  if (!conversation) {
    notFound();
  }

  // Load messages in chronological order (oldest first → newest at bottom).
  const { data: messages } = await admin
    .from("whatsapp_messages")
    .select(
      "id, wa_message_id, direction, message_type, body, media_url, status, ai_generated, sent_at, created_at"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <ConversationThread
      conversation={conversation}
      messages={(messages ?? []) as WhatsAppMessageRow[]}
    />
  );
}
