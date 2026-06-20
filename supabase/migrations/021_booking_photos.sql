-- Phase 4 of the technician panel: site photos.
--
-- The technician documents each visit from their phone — typically a "before"
-- shot of the install location and an "after" shot of the finished unit. Photos
-- are stored in the public `booking-photos` bucket and referenced here so the
-- office (admin) and the customer record have visual proof of the work.

CREATE TABLE public.booking_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  -- Who uploaded it (the assigned tech). Kept for audit; nullable so an admin
  -- upload path could exist later without a technician row.
  technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,

  -- Storage object path inside the booking-photos bucket + its public URL.
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,

  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('before', 'after', 'other')),
  caption TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.booking_photos ENABLE ROW LEVEL SECURITY;

-- Writes happen through the service-role admin client in the tech API (gated by
-- the tech cookie), so only owner read/delete policies are needed for the admin
-- panel; the service role bypasses RLS.
CREATE POLICY "Users can view own booking photos"
  ON public.booking_photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own booking photos"
  ON public.booking_photos FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_booking_photos_booking ON public.booking_photos(booking_id, created_at);
CREATE INDEX idx_booking_photos_user ON public.booking_photos(user_id);

-- Public bucket for the photos (public read, same model as post-media). Writes
-- and deletes go through the service role in the tech API.
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-photos', 'booking-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read on booking-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'booking-photos');
