-- Lets a quick-reply template carry an image, sent alongside the message
-- text as its caption (e.g. a price list photo behind "/pricing").
ALTER TABLE public.reply_templates
  ADD COLUMN media_url TEXT;
