-- Per-conversation AI pause flag.
-- When ai_paused = true, the auto-reply service skips generating an AI reply
-- for incoming messages on this conversation. Inbound messages are still
-- stored and visible in the thread — only the AI reply step is skipped so
-- a human can take over.

ALTER TABLE public.whatsapp_conversations
ADD COLUMN ai_paused BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_whatsapp_conversations_ai_paused
  ON public.whatsapp_conversations(user_id, ai_paused)
  WHERE ai_paused = TRUE;
