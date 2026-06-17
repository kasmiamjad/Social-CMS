export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MessengerConversationList,
  type MessengerConversationSummary,
} from "@/components/messenger/conversation-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export default async function MessengerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Messenger</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to view conversations.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("messenger_conversations")
    .select("id, psid, contact_name, last_message_at, last_message_preview, unread_count, is_archived")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const conversations = (data ?? []) as MessengerConversationSummary[];

  return (
    <div>
      <RealtimeRefresh tables={["messenger_conversations", "messenger_messages"]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
          Messenger
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Incoming Facebook Page messages with AI auto-reply
        </p>
      </div>

      <MessengerConversationList conversations={conversations} />
    </div>
  );
}
