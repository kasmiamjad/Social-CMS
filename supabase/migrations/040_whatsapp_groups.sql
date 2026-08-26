-- WhatsApp group chats: read + reply from the CRM, kept fully separate from
-- the AI auto-reply / lead / booking pipeline (built for 1:1 customer
-- conversations, which a multi-person group doesn't fit).

CREATE TABLE public.whatsapp_group_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, group_jid)
);

ALTER TABLE public.whatsapp_group_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view whatsapp group conversations"
  ON public.whatsapp_group_conversations FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own whatsapp group conversations"
  ON public.whatsapp_group_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp group conversations"
  ON public.whatsapp_group_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER whatsapp_group_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_group_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_whatsapp_group_conversations_last_message
  ON public.whatsapp_group_conversations(user_id, last_message_at DESC NULLS LAST);

CREATE TABLE public.whatsapp_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_conversation_id UUID NOT NULL REFERENCES public.whatsapp_group_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio', 'audio_file', 'video', 'document', 'sticker', 'location')),
  sender_jid TEXT,
  sender_name TEXT,
  body TEXT,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view whatsapp group messages"
  ON public.whatsapp_group_messages FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own whatsapp group messages"
  ON public.whatsapp_group_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_whatsapp_group_messages_conversation
  ON public.whatsapp_group_messages(group_conversation_id, created_at DESC);

CREATE UNIQUE INDEX idx_whatsapp_group_messages_wa_id
  ON public.whatsapp_group_messages(wa_message_id)
  WHERE wa_message_id IS NOT NULL;
