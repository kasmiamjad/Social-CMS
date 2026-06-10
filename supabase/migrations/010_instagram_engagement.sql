-- Instagram engagement automation: DMs + comments.
-- Mirrors the WhatsApp + YouTube patterns:
--   * Per-user master config with separate toggles for DMs and comments
--   * DM conversations + messages (chat thread)
--   * Comments table (one row per inbound comment + AI reply lifecycle)
--   * Per-conversation / per-comment ai_paused flag for human takeover

-- One row per user. Holds both the master switch AND separate enable/auto_reply
-- toggles for DMs and comments so the user can fine-tune each channel.
CREATE TABLE public.instagram_automation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Master switch — when FALSE, the entire AI engine is paused regardless
  -- of per-channel settings.
  enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- DM channel
  dms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  dms_auto_reply BOOLEAN NOT NULL DEFAULT FALSE,
  dms_system_prompt TEXT NOT NULL,

  -- Comments channel
  comments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  comments_auto_reply BOOLEAN NOT NULL DEFAULT FALSE,
  comments_system_prompt TEXT NOT NULL,

  -- Shared
  signature_suffix TEXT NOT NULL DEFAULT '',
  business_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  business_hours_start TIME,
  business_hours_end TIME,
  business_hours_timezone TEXT DEFAULT 'UTC',
  out_of_hours_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.instagram_automation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ig automation config"
  ON public.instagram_automation_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ig automation config"
  ON public.instagram_automation_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ig automation config"
  ON public.instagram_automation_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ig automation config"
  ON public.instagram_automation_configs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER instagram_automation_configs_updated_at
  BEFORE UPDATE ON public.instagram_automation_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ───────────────────────── DM CONVERSATIONS ─────────────────────────
CREATE TABLE public.instagram_dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_ig_id TEXT NOT NULL,
  contact_username TEXT,
  contact_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ai_paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, contact_ig_id)
);

ALTER TABLE public.instagram_dm_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ig dm conversations"
  ON public.instagram_dm_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ig dm conversations"
  ON public.instagram_dm_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ig dm conversations"
  ON public.instagram_dm_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ig dm conversations"
  ON public.instagram_dm_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER instagram_dm_conversations_updated_at
  BEFORE UPDATE ON public.instagram_dm_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_ig_dm_conversations_user_contact
  ON public.instagram_dm_conversations(user_id, contact_ig_id);
CREATE INDEX idx_ig_dm_conversations_last_message
  ON public.instagram_dm_conversations(user_id, last_message_at DESC NULLS LAST);

-- ───────────────────────── DM MESSAGES ─────────────────────────
CREATE TABLE public.instagram_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.instagram_dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_message_id TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'video', 'audio', 'reaction', 'story_reply', 'share', 'unsupported')),
  body TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  status_error TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.instagram_dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ig dm messages"
  ON public.instagram_dm_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ig dm messages"
  ON public.instagram_dm_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ig dm messages"
  ON public.instagram_dm_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ig dm messages"
  ON public.instagram_dm_messages FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ig_dm_messages_conversation
  ON public.instagram_dm_messages(conversation_id, created_at DESC);
CREATE INDEX idx_ig_dm_messages_user_created
  ON public.instagram_dm_messages(user_id, created_at DESC);
CREATE INDEX idx_ig_dm_messages_ig_id
  ON public.instagram_dm_messages(ig_message_id) WHERE ig_message_id IS NOT NULL;

-- ───────────────────────── COMMENTS ─────────────────────────
CREATE TABLE public.instagram_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL,
  ig_comment_id TEXT NOT NULL UNIQUE,
  parent_comment_id TEXT,
  author_ig_id TEXT,
  author_username TEXT,
  comment_text TEXT NOT NULL,
  ai_reply TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'posted', 'skipped', 'failed')),
  status_error TEXT,
  ai_paused BOOLEAN NOT NULL DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.instagram_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ig comments"
  ON public.instagram_comments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ig comments"
  ON public.instagram_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ig comments"
  ON public.instagram_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ig comments"
  ON public.instagram_comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ig_comments_user_media ON public.instagram_comments(user_id, ig_media_id);
CREATE INDEX idx_ig_comments_status ON public.instagram_comments(status);
CREATE INDEX idx_ig_comments_created ON public.instagram_comments(user_id, created_at DESC);
