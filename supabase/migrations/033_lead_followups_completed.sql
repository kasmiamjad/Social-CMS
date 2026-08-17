-- Lets a follow-up be marked done (instead of only ever adding new ones).
-- NULL = still pending; a timestamp = when it was completed.
ALTER TABLE public.lead_followups
  ADD COLUMN completed_at TIMESTAMPTZ;
