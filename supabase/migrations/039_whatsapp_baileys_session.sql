-- WhatsApp Web link (Baileys) session storage, replacing the Meta Cloud API's
-- token-based platform_credentials row for WhatsApp. Baileys' auth state
-- (creds + signal key store) must NOT live on local disk — this app deploys
-- with `output: "standalone"`, which fully regenerates .next/standalone/ on
-- every build, wiping any file-based session and forcing a fresh QR scan on
-- every deploy. Storing it in Supabase instead survives redeploys/restarts.

-- Baileys' AuthenticationCreds blob. One row per tenant.
CREATE TABLE public.whatsapp_baileys_creds (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creds JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_baileys_creds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view whatsapp baileys creds"
  ON public.whatsapp_baileys_creds FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own whatsapp baileys creds"
  ON public.whatsapp_baileys_creds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp baileys creds"
  ON public.whatsapp_baileys_creds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp baileys creds"
  ON public.whatsapp_baileys_creds FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER whatsapp_baileys_creds_updated_at
  BEFORE UPDATE ON public.whatsapp_baileys_creds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Signal protocol key store — one row per key (pre-keys, sessions, sender-keys,
-- app-state-sync-keys, ...). Mirrors what useMultiFileAuthState stores as
-- one file per key; here it's one Postgres row per key instead.
CREATE TABLE public.whatsapp_baileys_keys (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key_id)
);

ALTER TABLE public.whatsapp_baileys_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view whatsapp baileys keys"
  ON public.whatsapp_baileys_keys FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own whatsapp baileys keys"
  ON public.whatsapp_baileys_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp baileys keys"
  ON public.whatsapp_baileys_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp baileys keys"
  ON public.whatsapp_baileys_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Connection/link status shown in the Settings QR-connect card.
CREATE TABLE public.whatsapp_connection_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'qr_pending', 'connected')),
  qr_code TEXT,
  connected_number TEXT,
  last_connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_connection_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view whatsapp connection status"
  ON public.whatsapp_connection_status FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own whatsapp connection status"
  ON public.whatsapp_connection_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp connection status"
  ON public.whatsapp_connection_status FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER whatsapp_connection_status_updated_at
  BEFORE UPDATE ON public.whatsapp_connection_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
