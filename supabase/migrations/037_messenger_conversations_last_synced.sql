-- Tracks when a Messenger conversation was last reconciled against Meta's
-- Conversations API (see MessengerService.fetchConversationMessages) — lets
-- the messages route throttle that Graph API call instead of firing it on
-- every 5s poll from the chat drawer.
ALTER TABLE public.messenger_conversations
  ADD COLUMN last_synced_at TIMESTAMPTZ;
