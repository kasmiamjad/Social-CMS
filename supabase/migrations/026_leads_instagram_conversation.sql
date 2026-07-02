-- Link leads back to the Instagram DM conversation that produced them, so an
-- incoming Instagram DM becomes a lead just like WhatsApp and Messenger — all
-- channels land in the one Leads pipeline. ('instagram' is already an allowed
-- lead source from migration 011.)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS instagram_conversation_id UUID
    REFERENCES public.instagram_dm_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_instagram_conv
  ON public.leads(instagram_conversation_id) WHERE instagram_conversation_id IS NOT NULL;
