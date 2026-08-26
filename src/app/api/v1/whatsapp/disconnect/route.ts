import { type NextRequest } from "next/server";
import { resolveUserId } from "@/lib/api-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { disconnectBaileys } from "@/services/platforms/whatsapp-baileys/baileys-connection";

/**
 * POST /api/v1/whatsapp/disconnect
 *
 * Unlinks the connected WhatsApp Web session from the Settings card.
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return apiError("UNAUTHORIZED", "Authentication required", 401);

  await disconnectBaileys();
  return apiSuccess({ disconnected: true });
}
