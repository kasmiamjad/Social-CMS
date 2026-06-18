-- Per-lead token for the public self-scheduling link (/book/:token).
-- The token is a capability — anyone with it can view availability and book
-- that lead's installation, so it's a random UUID.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS booking_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_booking_token ON public.leads(booking_token);
