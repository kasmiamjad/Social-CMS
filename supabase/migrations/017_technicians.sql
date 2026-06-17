-- Technician module: a real technician list + per-technician daily availability
-- slots. Bookings consume one open slot (capacity 1), so installs can only be
-- scheduled when a technician is actually free.

CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own technicians"
  ON public.technicians FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own technicians"
  ON public.technicians FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own technicians"
  ON public.technicians FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own technicians"
  ON public.technicians FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_technicians_user_active ON public.technicians(user_id, is_active);

-- Availability blocks. booking_id null = free; set = taken by that booking.
CREATE TABLE public.technician_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (technician_id, slot_date, start_time)
);

ALTER TABLE public.technician_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own technician slots"
  ON public.technician_slots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own technician slots"
  ON public.technician_slots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own technician slots"
  ON public.technician_slots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own technician slots"
  ON public.technician_slots FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER technician_slots_updated_at
  BEFORE UPDATE ON public.technician_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_technician_slots_user_date ON public.technician_slots(user_id, slot_date);
CREATE INDEX idx_technician_slots_tech_date ON public.technician_slots(technician_id, slot_date);
CREATE INDEX idx_technician_slots_open
  ON public.technician_slots(technician_id, slot_date)
  WHERE booking_id IS NULL;
CREATE INDEX idx_technician_slots_booking
  ON public.technician_slots(booking_id) WHERE booking_id IS NOT NULL;

-- Link bookings to a technician + the slot they consume.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES public.technician_slots(id) ON DELETE SET NULL;
