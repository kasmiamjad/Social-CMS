import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserId } from "@/lib/api-auth";
import { getTenantId } from "@/lib/tenant";
import { apiError, apiSuccess } from "@/lib/api-response";

interface ConnectionStatusRow {
  status: string;
  qr_code: string | null;
  connected_number: string | null;
  last_connected_at: string | null;
}

/**
 * GET /api/v1/whatsapp/connection-status
 *
 * Polled by the Settings QR-connect card to show the current QR code (while
 * unlinked) or the connected number, without exposing anything sensitive —
 * Baileys' auth state itself never leaves the server.
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  const supabase = createAdminClient();
  const tenantId = getTenantId();
  const { data } = await supabase
    .from("whatsapp_connection_status")
    .select("status, qr_code, connected_number, last_connected_at")
    .eq("user_id", tenantId)
    .maybeSingle<ConnectionStatusRow>();

  return apiSuccess(
    data ?? { status: "disconnected", qr_code: null, connected_number: null, last_connected_at: null }
  );
}
