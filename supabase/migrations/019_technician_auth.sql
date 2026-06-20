-- Technician panel: passcode login for technicians. The admin sets a passcode
-- per technician; the hash is stored here (scrypt salt:hash). Login is by
-- phone + passcode, issuing a signed cookie session (no Supabase auth user).
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS passcode_hash TEXT;
