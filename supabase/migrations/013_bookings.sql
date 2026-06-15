-- Bookings: a lead converted into a confirmed installation (or, later, a service
-- visit). One lead can have many bookings over time (reschedules, recurring
-- service). The booking carries a price/product snapshot so the customer-facing
-- confirmation stays accurate even if the parent lead is edited afterwards.
--
-- Lifecycle: lead (won/quoted) → booking 'scheduled' → 'confirmed' → 'completed'.
-- A WhatsApp confirmation is sent on creation; we record which delivery path was
-- used (approved template vs free-text inside the 24h window) and the message id.

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Human-friendly reference, e.g. "SADA-2026-0001". serial is per-user and
  -- monotonic (mirrors leads.serial_no); booking_ref is the composed display value.
  booking_serial INT NOT NULL,
  booking_ref TEXT NOT NULL,

  -- 'installation' for now; 'service' reserved for the upcoming service-reminder flow.
  type TEXT NOT NULL DEFAULT 'installation'
    CHECK (type IN ('installation', 'service')),

  -- When the technician is scheduled to arrive. Exact timestamp; slot_label is an
  -- optional friendly window ("Morning 9–12") shown to the customer instead of a time.
  scheduled_at TIMESTAMPTZ NOT NULL,
  slot_label TEXT,

  -- Order snapshot (frozen at booking time)
  product_snapshot TEXT,                 -- product_model at time of booking
  qty_snapshot INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'SAR',
  total_amount NUMERIC(12, 2),           -- unit_price * qty_snapshot (computed in app)
  address_snapshot TEXT,                 -- location_address at time of booking

  -- Assignment / notes
  technician TEXT,
  notes TEXT,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),

  -- WhatsApp confirmation tracking
  whatsapp_message_id TEXT,              -- wa_message_id of the confirmation we sent
  delivery_method TEXT
    CHECK (delivery_method IN ('template', 'free_text')),
  confirmation_sent_at TIMESTAMPTZ,
  confirmation_error TEXT,               -- populated if Meta rejected the send

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, booking_serial),
  UNIQUE (user_id, booking_ref)
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookings"
  ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings"
  ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookings"
  ON public.bookings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_bookings_user_status ON public.bookings(user_id, status);
CREATE INDEX idx_bookings_user_scheduled ON public.bookings(user_id, scheduled_at);
CREATE INDEX idx_bookings_lead ON public.bookings(lead_id);

-- Helper: next per-user booking serial (same pattern as next_lead_serial_no).
-- The API composes the booking_ref string from this value + the year.
CREATE OR REPLACE FUNCTION public.next_booking_serial(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  next_no INT;
BEGIN
  SELECT COALESCE(MAX(booking_serial), 0) + 1 INTO next_no
  FROM public.bookings
  WHERE user_id = p_user_id;
  RETURN next_no;
END;
$$;

-- Extend the leads status enum with 'scheduled' (a lead that has a booking).
-- Inline CHECK constraints get the auto-name <table>_<column>_check.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'scheduled', 'installed', 'in_service'));
