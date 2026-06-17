-- Enable Supabase Realtime (postgres_changes) on the tables the dashboard
-- listens to, so new leads / messages / bookings push to the UI instantly.
-- Idempotent: skips any table already in the supabase_realtime publication.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads',
    'bookings',
    'whatsapp_conversations',
    'whatsapp_messages',
    'messenger_conversations',
    'messenger_messages'
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
