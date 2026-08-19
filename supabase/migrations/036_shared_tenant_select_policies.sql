-- All logins now share one CRM dataset (see src/lib/tenant.ts) — every read/write
-- goes through the service-role admin client scoped to a fixed TENANT_ID, so RLS
-- is bypassed for the app's own queries. But Supabase Realtime delivery to the
-- browser still runs under the viewer's own session JWT and is gated by each
-- table's SELECT policy. With "auth.uid() = user_id" that policy now only ever
-- matches the original tenant account, so any other login's live changefeed
-- (chat/dashboard auto-refresh) would silently stop working.
--
-- This relaxes SELECT only — to "any authenticated login" — on the tables the
-- shared-tenant feature covers. INSERT/UPDATE/DELETE policies are untouched:
-- nothing in the app writes to these tables via the browser session client.

CREATE POLICY "Any authenticated user can view leads"
  ON public.leads FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own leads" ON public.leads;

CREATE POLICY "Any authenticated user can view whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own whatsapp conversations" ON public.whatsapp_conversations;

CREATE POLICY "Any authenticated user can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own whatsapp messages" ON public.whatsapp_messages;

CREATE POLICY "Any authenticated user can view whatsapp automation config"
  ON public.whatsapp_automation_configs FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own whatsapp automation config" ON public.whatsapp_automation_configs;

CREATE POLICY "Any authenticated user can view messenger conversations"
  ON public.messenger_conversations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own messenger conversations" ON public.messenger_conversations;

CREATE POLICY "Any authenticated user can view messenger messages"
  ON public.messenger_messages FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own messenger messages" ON public.messenger_messages;

CREATE POLICY "Any authenticated user can view ig dm conversations"
  ON public.instagram_dm_conversations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own ig dm conversations" ON public.instagram_dm_conversations;

CREATE POLICY "Any authenticated user can view ig dm messages"
  ON public.instagram_dm_messages FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own ig dm messages" ON public.instagram_dm_messages;

CREATE POLICY "Any authenticated user can view ig automation config"
  ON public.instagram_automation_configs FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own ig automation config" ON public.instagram_automation_configs;

CREATE POLICY "Any authenticated user can view bookings"
  ON public.bookings FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own bookings" ON public.bookings;

CREATE POLICY "Any authenticated user can view technicians"
  ON public.technicians FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own technicians" ON public.technicians;

CREATE POLICY "Any authenticated user can view technician slots"
  ON public.technician_slots FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own technician slots" ON public.technician_slots;

CREATE POLICY "Any authenticated user can view lead followups"
  ON public.lead_followups FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own lead followups" ON public.lead_followups;

CREATE POLICY "Any authenticated user can view reply templates"
  ON public.reply_templates FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY "Users can view own reply templates" ON public.reply_templates;
