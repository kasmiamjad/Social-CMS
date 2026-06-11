-- Lead management table. Captures customer enquiries from any channel
-- (WhatsApp AI, manual entry, etc.) and tracks them through the full
-- lifecycle: lead → qualified → won → installed → service.

-- Per-user auto-incrementing serial number (the "S.No" column in the Excel).
-- Each user gets their own sequence starting at 1.
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Serial / external identifiers
  serial_no INT NOT NULL,                -- auto-assigned per user (1, 2, 3…)
  client_code TEXT,                      -- manual code like KBR0018, DMM0010
  qr_code TEXT,

  -- Customer info
  client_name TEXT NOT NULL,
  client_phone TEXT,                     -- E.164 or local format
  client_email TEXT,
  client_business_type TEXT,             -- "Coffee shop", "Office", "Accommodation", "Medical Center", etc.

  -- Product
  product_qty INT NOT NULL DEFAULT 1,
  product_model TEXT,                    -- e.g. "400 GAL - AQUA TOWER", "200 GAL - AQUA PLUS"

  -- Dates
  lead_date DATE NOT NULL DEFAULT CURRENT_DATE,
  installation_date DATE,
  next_service_date DATE,

  -- Service details
  scope TEXT,                            -- "3 STAGE FILTERS, 6 STAGE FILTERS" etc.
  installed_by TEXT,                     -- technician name

  -- Location
  location_address TEXT,
  location_url TEXT,                     -- Google Maps share URL
  location_lat NUMERIC,
  location_lng NUMERIC,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'installed', 'in_service')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'whatsapp_ai', 'instagram', 'youtube', 'website_form', 'phone_call', 'walk_in', 'referral')),

  -- Linkage back to the WhatsApp conversation that produced the lead
  whatsapp_conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,

  -- Notes
  remarks TEXT,
  internal_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, serial_no)
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads"
  ON public.leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leads"
  ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads"
  ON public.leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads"
  ON public.leads FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_leads_user_status ON public.leads(user_id, status);
CREATE INDEX idx_leads_user_created ON public.leads(user_id, created_at DESC);
CREATE INDEX idx_leads_phone ON public.leads(client_phone);
CREATE INDEX idx_leads_whatsapp_conv ON public.leads(whatsapp_conversation_id) WHERE whatsapp_conversation_id IS NOT NULL;

-- Helper function: get the next per-user serial_no.
-- Called from API code (not a trigger) so we can also accept manual overrides.
CREATE OR REPLACE FUNCTION public.next_lead_serial_no(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  next_no INT;
BEGIN
  SELECT COALESCE(MAX(serial_no), 0) + 1 INTO next_no
  FROM public.leads
  WHERE user_id = p_user_id;
  RETURN next_no;
END;
$$;
