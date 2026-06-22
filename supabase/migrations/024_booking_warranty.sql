-- Installed-base / warranty tracking. Every completed booking becomes a customer
-- install record (see the admin Customers page). Warranty runs from the actual
-- install date (bookings.completed_at) for `warranty_months` months. Default 12;
-- editable per booking later if some products carry a longer warranty.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS warranty_months INT NOT NULL DEFAULT 12;
