-- Meta's webhook marks inbound audio with a "voice" boolean — true for a
-- recorded voice note, false for a regular shared audio file (e.g. a song).
-- 'audio' keeps meaning "voice note" (the existing/common case, rendered with
-- the voice-note waveform player); 'audio_file' is the new distinct type for
-- voice: false, rendered as a plain audio player instead.
ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'audio', 'audio_file', 'video', 'document', 'sticker', 'location', 'template', 'interactive'));
