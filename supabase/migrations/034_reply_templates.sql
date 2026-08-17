-- Quick-reply templates for WhatsApp, matching WhatsApp Business's own
-- "/shortcut" autocomplete: typing "/" + a shortcut in the reply box
-- suggests these and fills in the full saved message.
CREATE TABLE public.reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, shortcut)
);

ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reply templates"
  ON public.reply_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reply templates"
  ON public.reply_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reply templates"
  ON public.reply_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reply templates"
  ON public.reply_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER reply_templates_updated_at
  BEFORE UPDATE ON public.reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_reply_templates_user ON public.reply_templates(user_id, shortcut);
