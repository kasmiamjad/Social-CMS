-- Structured event log for the WhatsApp (Baileys) connection and sends, so
-- connection bounces / retry attempts / send failures can be watched live
-- from a page in the CRM instead of SSHing in to read pm2 logs.

CREATE TABLE public.whatsapp_debug_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  event TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_debug_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view whatsapp debug log"
  ON public.whatsapp_debug_log FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_whatsapp_debug_log_user_created
  ON public.whatsapp_debug_log(user_id, created_at DESC);
