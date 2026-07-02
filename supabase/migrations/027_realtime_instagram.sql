-- Add the Instagram DM tables to the Realtime publication so the Leads page (and
-- any Instagram views) push live, like WhatsApp/Messenger already do. Extends
-- migration 016. Idempotent — skips tables already in the publication.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'instagram_dm_conversations',
    'instagram_dm_messages'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
