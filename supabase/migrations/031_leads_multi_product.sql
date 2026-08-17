-- Lets a lead carry more than one product line item (e.g. 2 dispensers +
-- 1 RO purifier). `product_qty`/`product_model` stay as-is and keep driving
-- booking creation/pricing — they're kept in sync with the first row here so
-- booking.service.ts needs no changes. `products` is the full list for
-- display/editing on the lead itself.
ALTER TABLE public.leads
  ADD COLUMN products JSONB NOT NULL DEFAULT '[]';
