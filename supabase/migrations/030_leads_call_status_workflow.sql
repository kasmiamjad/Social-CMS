-- Expands `call_status` into a full triage workflow: a lead starts 'unread'
-- when auto-created from an inbound WhatsApp/Messenger/Instagram message,
-- flips to 'read' when a team member opens it, then moves through the call
-- outcomes. 'not_interested', 'unanswered', 'follow_up' and 'converted'
-- already existed (029); this adds 'unread', 'read' and 'link_send'.
--
-- Drop-by-lookup instead of a hardcoded constraint name, since Postgres
-- auto-names the check constraint from migration 029 and we don't want this
-- migration to depend on guessing that name correctly.
DO $$
DECLARE
  con text;
BEGIN
  SELECT pg_constraint.conname INTO con
  FROM pg_constraint
  JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
  WHERE pg_class.relname = 'leads'
    AND pg_constraint.contype = 'c'
    AND pg_get_constraintdef(pg_constraint.oid) LIKE '%call_status%';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', con);
  END IF;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_call_status_check
  CHECK (call_status IN ('unread', 'read', 'follow_up', 'unanswered', 'not_interested', 'link_send', 'converted'));
