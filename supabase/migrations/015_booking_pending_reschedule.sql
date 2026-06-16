-- Holds a customer-proposed reschedule time awaiting their "YES" confirmation
-- over WhatsApp. Applied to scheduled_at once confirmed, then cleared.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pending_reschedule_at TIMESTAMPTZ;
