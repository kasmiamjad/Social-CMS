import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

/**
 * GET /api/v1/whatsapp/conversations
 *
 * List the authenticated user's WhatsApp conversations, ordered by most-recent
 * activity. Returns a flat list — pagination can be added later if needed.
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, contact_phone, contact_name, last_message_at, last_message_preview, unread_count, is_archived, created_at"
    )
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    return apiError("LOAD_FAILED", error.message, 500);
  }

  return apiSuccess({ conversations: data ?? [] });
}
