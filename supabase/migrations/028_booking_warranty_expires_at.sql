-- A warranty-expiry timestamp on bookings so the Customers page can filter
-- (active vs expired) and sort by warranty in the database instead of computing
-- it in JS. Maintained by a trigger (not a GENERATED column, because
-- timestamptz + interval is only STABLE, which generated columns disallow).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_booking_warranty_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL THEN
    NEW.warranty_expires_at :=
      NEW.completed_at + ((COALESCE(NEW.warranty_months, 12) || ' months')::interval);
  ELSE
    NEW.warranty_expires_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_warranty_expiry ON public.bookings;
CREATE TRIGGER bookings_warranty_expiry
  BEFORE INSERT OR UPDATE OF completed_at, warranty_months ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_warranty_expiry();

-- Backfill existing completed installs.
UPDATE public.bookings
  SET warranty_expires_at = completed_at + ((COALESCE(warranty_months, 12) || ' months')::interval)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_warranty_expires
  ON public.bookings(user_id, warranty_expires_at)
  WHERE status = 'completed';
