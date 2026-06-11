import { type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const FromConversationSchema = z.object({
  conversation_id: z.string().uuid(),
});

interface ConvRow {
  id: string;
  user_id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_preview: string | null;
}

/**
 * POST /api/v1/leads/from-conversation
 *
 * Pre-fill a new lead from a WhatsApp conversation. Creates a `new` status
 * lead with the customer's phone + name pre-populated, and links it back to
 * the conversation. The frontend then opens the lead edit form so the
 * operator can fill in the remaining details.
 *
 * If a lead already exists for this conversation, returns the existing one.
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  let parsed: z.infer<typeof FromConversationSchema>;
  try {
    parsed = FromConversationSchema.parse(await request.json());
  } catch (err) {
    return apiError(
      "INVALID_REQUEST",
      err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body",
      400
    );
  }

  const supabase = createAdminClient();

  // Verify conversation belongs to this user
  const { data: conv, error: convError } = await supabase
    .from("whatsapp_conversations")
    .select("id, user_id, contact_phone, contact_name, last_message_preview")
    .eq("id", parsed.conversation_id)
    .eq("user_id", userId)
    .maybeSingle<ConvRow>();

  if (convError) return apiError("LOAD_FAILED", convError.message, 500);
  if (!conv) return apiError("NOT_FOUND", "Conversation not found", 404);

  // Reuse an existing lead for this conversation if one exists
  const { data: existing } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("whatsapp_conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return apiSuccess({ lead: existing, reused: true });
  }

  // Assign next serial_no
  const { data: nextNoData } = await supabase
    .rpc("next_lead_serial_no", { p_user_id: userId })
    .single<number>();
  const serial_no = typeof nextNoData === "number" ? nextNoData : 1;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      user_id: userId,
      serial_no,
      client_name: conv.contact_name?.trim() || conv.contact_phone,
      client_phone: conv.contact_phone,
      status: "new",
      source: "whatsapp_ai",
      whatsapp_conversation_id: conv.id,
      remarks: conv.last_message_preview ?? null,
    })
    .select("*")
    .single();

  if (error) return apiError("CREATE_FAILED", error.message, 500);

  return apiSuccess({ lead: data, reused: false });
}
