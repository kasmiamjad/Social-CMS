-- Phase 3 of the technician panel: rich job-status progression with timestamps.
--
-- The technician advances a booking through the field workflow from their phone:
--   scheduled/confirmed → on_the_way → arrived → completed | no_show
-- Each step stamps the moment it happened so the office (admin Bookings) and the
-- customer record have an accurate timeline of the visit. `completion_notes`
-- captures what the tech did / why a visit was a no-show.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS on_the_way_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Extend the status CHECK with the two new in-progress states. The original
-- constraint is the inline auto-named bookings_status_check (see 013_bookings.sql).
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'scheduled', 'confirmed', 'on_the_way', 'arrived',
    'completed', 'cancelled', 'no_show'
  ));
