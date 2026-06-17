import type { createAdminClient } from "@/lib/supabase/admin";

/** De-duplicates and drops null conversation ids. */
export function uniqueConversationIds(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/**
 * Builds a per-conversation summary (last inbound/customer message + total
 * message count) for the given conversation ids, from a single query per
 * channel. Capped at 5000 rows — enough for a small CRM.
 */
export async function buildChatInfo(
  admin: ReturnType<typeof createAdminClient>,
  table: "whatsapp_messages" | "messenger_messages",
  conversationIds: string[]
): Promise<Map<string, { lastCustomerMsg: string | null; count: number }>> {
  const map = new Map<string, { lastCustomerMsg: string | null; count: number }>();
  if (conversationIds.length === 0) return map;

  const { data } = await admin
    .from(table)
    .select("conversation_id, direction, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true })
    .limit(5000);

  for (const row of (data ?? []) as Array<{
    conversation_id: string;
    direction: string;
    body: string | null;
  }>) {
    const cur = map.get(row.conversation_id) ?? { lastCustomerMsg: null, count: 0 };
    cur.count += 1;
    // Ascending order means the last inbound row we see is the most recent one.
    if (row.direction === "inbound" && typeof row.body === "string" && row.body.trim()) {
      cur.lastCustomerMsg = row.body;
    }
    map.set(row.conversation_id, cur);
  }
  return map;
}
