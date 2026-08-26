// Always fetch fresh data — new group messages may have arrived.
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/tenant";
import {
  GroupConversationList,
  type WhatsAppGroupConversationSummary,
} from "@/components/whatsapp-groups/group-conversation-list";

/**
 * WhatsApp group chats — read + reply only, kept separate from the AI
 * auto-reply / lead / booking pipeline built for 1:1 customer conversations.
 */
export default async function WhatsAppGroupsPage() {
  const admin = createAdminClient();
  const tenantId = getTenantId();

  const { data } = await admin
    .from("whatsapp_group_conversations")
    .select("id, group_jid, group_name, last_message_at, last_message_preview")
    .eq("user_id", tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const conversations = (data ?? []) as WhatsAppGroupConversationSummary[];

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          WhatsApp Groups
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Read and reply to group chats the linked WhatsApp number is a member of
        </p>
      </div>

      <div className="mt-6 max-w-2xl">
        <GroupConversationList conversations={conversations} />
      </div>
    </div>
  );
}
