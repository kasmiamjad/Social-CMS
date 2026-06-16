-- Facebook Messenger: conversations + messages, mirroring the WhatsApp tables.
-- Messages are keyed by the page-scoped sender id (PSID) rather than a phone.
-- AI auto-reply reuses the existing whatsapp_automation_configs row (one SA'DA
-- prompt drives both channels for now).

CREATE TABLE public.messenger_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,                 -- the Facebook Page that received the message
  psid TEXT NOT NULL,                    -- page-scoped id of the customer
  contact_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ai_paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, psid)
);

ALTER TABLE public.messenger_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messenger conversations"
  ON public.messenger_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messenger conversations"
  ON public.messenger_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messenger conversations"
  ON public.messenger_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messenger conversations"
  ON public.messenger_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER messenger_conversations_updated_at
  BEFORE UPDATE ON public.messenger_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_messenger_conversations_user_psid
  ON public.messenger_conversations(user_id, psid);
CREATE INDEX idx_messenger_conversations_last_message
  ON public.messenger_conversations(user_id, last_message_at DESC NULLS LAST);

CREATE TABLE public.messenger_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mid TEXT UNIQUE,                       -- Messenger message id (for dedupe)
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio', 'video', 'file', 'sticker', 'location', 'postback', 'fallback')),
  body TEXT,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  status_error TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messenger messages"
  ON public.messenger_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messenger messages"
  ON public.messenger_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messenger messages"
  ON public.messenger_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messenger messages"
  ON public.messenger_messages FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_messenger_messages_conversation
  ON public.messenger_messages(conversation_id, created_at DESC);
CREATE INDEX idx_messenger_messages_user_created
  ON public.messenger_messages(user_id, created_at DESC);
CREATE INDEX idx_messenger_messages_mid
  ON public.messenger_messages(mid) WHERE mid IS NOT NULL;

-- Link leads back to the Messenger conversation that produced them, and allow
-- 'facebook' as a lead source.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS messenger_conversation_id UUID
  REFERENCES public.messenger_conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_messenger_conv
  ON public.leads(messenger_conversation_id) WHERE messenger_conversation_id IS NOT NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('manual', 'whatsapp_ai', 'facebook', 'instagram', 'youtube', 'website_form', 'phone_call', 'walk_in', 'referral'));
