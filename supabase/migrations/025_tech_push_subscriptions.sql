-- Web Push subscriptions for the technician PWA. Each installed app/browser that
-- opts in stores one subscription (endpoint + keys). When a booking is assigned
-- to a technician, the server sends a push to all of that tech's subscriptions.
--
-- Writes happen through the service-role admin client (gated by the tech cookie),
-- so RLS is enabled with no anon policies — the service role bypasses it.

CREATE TABLE public.tech_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,

  -- The browser push endpoint is globally unique; the keys encrypt the payload.
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tech_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tech_push_sub_tech ON public.tech_push_subscriptions(technician_id);
