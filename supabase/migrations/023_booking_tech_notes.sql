-- Lets the technician keep working notes on a job from the field panel,
-- separate from the admin-authored `notes` and the `completion_notes` captured
-- when a visit is finished. Visible to the office on the booking record.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tech_notes TEXT;
