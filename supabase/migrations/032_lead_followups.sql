-- A running log of follow-up attempts per lead (date + note + who logged it),
-- since a lead is often called multiple times over days/weeks. The leads
-- list shows the most recent entry's date as "Next follow-up".
CREATE TABLE public.lead_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  follow_up_date DATE NOT NULL,
  note TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lead followups"
  ON public.lead_followups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lead followups"
  ON public.lead_followups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lead followups"
  ON public.lead_followups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lead followups"
  ON public.lead_followups FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_lead_followups_lead ON public.lead_followups(lead_id, follow_up_date DESC);
CREATE INDEX idx_lead_followups_user ON public.lead_followups(user_id);
