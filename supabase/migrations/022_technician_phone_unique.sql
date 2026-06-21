-- Fix: phone is the technician's login id (phone + passcode at /tech), but
-- nothing stopped two technicians from sharing a phone. With the same phone +
-- passcode, login could not tell them apart and resolved to an arbitrary row.
-- This enforces one phone per technician *within an owner* at the database level.
--
-- ⚠️ This index will FAIL to create if duplicate phones already exist. Run the
-- diagnostic below FIRST and resolve duplicates (change or clear one phone):
--
--   SELECT user_id, lower(phone) AS phone, count(*), array_agg(id) AS technician_ids
--   FROM public.technicians
--   WHERE phone IS NOT NULL AND btrim(phone) <> ''
--   GROUP BY user_id, lower(phone)
--   HAVING count(*) > 1;
--
-- Then for each extra row either give it a unique phone or clear it:
--   UPDATE public.technicians SET phone = NULL WHERE id = '<technician_id>';

CREATE UNIQUE INDEX IF NOT EXISTS idx_technicians_user_phone_unique
  ON public.technicians (user_id, lower(phone))
  WHERE phone IS NOT NULL AND btrim(phone) <> '';
