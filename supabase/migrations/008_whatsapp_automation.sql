-- WhatsApp Cloud API: conversations, messages, and automation configuration.
-- Mirrors the YouTube automation pattern (per-user RLS, soft-delete via archive,
-- AI-driven auto-reply with status tracking).

-- One row per (user, contact_phone). Aggregates message metadata for thread lists.
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, contact_phone)
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp conversations"
  ON public.whatsapp_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_whatsapp_conversations_user_phone
  ON public.whatsapp_conversations(user_id, contact_phone);

CREATE INDEX idx_whatsapp_conversations_last_message
  ON public.whatsapp_conversations(user_id, last_message_at DESC NULLS LAST);

-- Individual messages in both directions. user_id is denormalized for RLS speed.
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'template', 'interactive')),
  body TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  status_error TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp messages"
  ON public.whatsapp_messages FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_whatsapp_messages_conversation
  ON public.whatsapp_messages(conversation_id, created_at DESC);

CREATE INDEX idx_whatsapp_messages_user_created
  ON public.whatsapp_messages(user_id, created_at DESC);

CREATE INDEX idx_whatsapp_messages_wa_id
  ON public.whatsapp_messages(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- User-level AI auto-reply configuration. One row per user.
CREATE TABLE public.whatsapp_automation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reply BOOLEAN NOT NULL DEFAULT FALSE,
  system_prompt TEXT NOT NULL,
  signature_suffix TEXT NOT NULL DEFAULT '',
  business_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  business_hours_start TIME,
  business_hours_end TIME,
  business_hours_timezone TEXT DEFAULT 'UTC',
  out_of_hours_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_automation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp automation config"
  ON public.whatsapp_automation_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp automation config"
  ON public.whatsapp_automation_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp automation config"
  ON public.whatsapp_automation_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp automation config"
  ON public.whatsapp_automation_configs FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER whatsapp_automation_configs_updated_at
  BEFORE UPDATE ON public.whatsapp_automation_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
