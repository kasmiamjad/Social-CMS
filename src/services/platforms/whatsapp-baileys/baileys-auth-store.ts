import { createAdminClient } from "@/lib/supabase/admin";
import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";

/**
 * Baileys' AuthenticationState, backed by Supabase instead of local files.
 *
 * This app deploys with `output: "standalone"` (next.config.ts) — every
 * `npm run build` fully regenerates .next/standalone/, which would wipe
 * Baileys' default file-based session (useMultiFileAuthState) on the very
 * next deploy and force a fresh QR scan each time. Storing the session in
 * Supabase instead survives redeploys and server restarts.
 *
 * Mirrors Baileys' own useMultiFileAuthState 1:1 (see its source in
 * node_modules/@whiskeysockets/baileys/lib/Utils/use-multi-file-auth-state.js)
 * — same creds/keys shape, same BufferJSON (de)serialization — just swapping
 * file reads/writes for Supabase table reads/writes.
 */
export async function makeSupabaseAuthState(
  tenantId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const supabase = createAdminClient();

  const toJsonSafe = (data: unknown): unknown => JSON.parse(JSON.stringify(data, BufferJSON.replacer));
  const fromJsonSafe = (data: unknown): unknown => JSON.parse(JSON.stringify(data), BufferJSON.reviver);

  const { data: credsRow } = await supabase
    .from("whatsapp_baileys_creds")
    .select("creds")
    .eq("user_id", tenantId)
    .maybeSingle<{ creds: unknown }>();

  const creds: AuthenticationCreds = credsRow
    ? (fromJsonSafe(credsRow.creds) as AuthenticationCreds)
    : initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [_: string]: SignalDataTypeMap[typeof type] } = {};
          const keyIds = ids.map((id) => `${type}-${id}`);

          const { data: rows } = await supabase
            .from("whatsapp_baileys_keys")
            .select("key_id, data")
            .eq("user_id", tenantId)
            .in("key_id", keyIds);

          for (const id of ids) {
            const row = rows?.find((r) => r.key_id === `${type}-${id}`);
            if (!row) continue;
            let value = fromJsonSafe(row.data);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value as object);
            }
            data[id] = value as SignalDataTypeMap[typeof type];
          }
          return data;
        },
        set: async (data) => {
          const upserts: { user_id: string; key_id: string; data: unknown }[] = [];
          const deleteIds: string[] = [];

          for (const category in data) {
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const value = data[category as keyof SignalDataTypeMap]![id];
              const keyId = `${category}-${id}`;
              if (value) {
                upserts.push({ user_id: tenantId, key_id: keyId, data: toJsonSafe(value) });
              } else {
                deleteIds.push(keyId);
              }
            }
          }

          if (upserts.length > 0) {
            await supabase.from("whatsapp_baileys_keys").upsert(upserts, { onConflict: "user_id,key_id" });
          }
          if (deleteIds.length > 0) {
            await supabase.from("whatsapp_baileys_keys").delete().eq("user_id", tenantId).in("key_id", deleteIds);
          }
        },
      },
    },
    saveCreds: async () => {
      await supabase
        .from("whatsapp_baileys_creds")
        .upsert({ user_id: tenantId, creds: toJsonSafe(creds) }, { onConflict: "user_id" });
    },
  };
}

/** Wipes the stored session — called when Baileys reports a logged-out disconnect. */
export async function clearBaileysAuthState(tenantId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("whatsapp_baileys_creds").delete().eq("user_id", tenantId);
  await supabase.from("whatsapp_baileys_keys").delete().eq("user_id", tenantId);
}
