-- Adds call-tracking fields mirroring the team's Excel call sheet:
-- who the lead is assigned to, which city it's in, and a lightweight
-- call outcome that's independent of the sales pipeline `status`.
ALTER TABLE public.leads
  ADD COLUMN assigned_to TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN call_status TEXT
    CHECK (call_status IN ('not_interested', 'unanswered', 'follow_up', 'converted'));

CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_leads_city ON public.leads(city) WHERE city IS NOT NULL;
