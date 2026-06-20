# a3sixty / SA'DA H2O — Session Handoff

_Last updated: 2026-06-20_

## What this project is
A **Next.js 16 SaaS CRM + multi-channel AI bot** for **SA'DA H2O Purifiers** (water-purifier business in Saudi Arabia). Customers chat on **WhatsApp / Facebook Messenger / Instagram** → an AI bot qualifies them → leads are auto-created → the team schedules **installations** with **technicians** → customers can **self-schedule** via a public link → **technicians** manage their jobs on a mobile panel.

- **GitHub:** https://github.com/kasmiamjad/Social-CMS  (branch `main`)
- **Live:** https://crm.a3sixty.com
- **VPS:** `185.214.134.177` — path `/var/www/social-cms` — PM2 app `social-cms`
- **Local:** `C:\Users\LENOVO\OneDrive\Desktop\drive sync\socialsyncs`
- **Supabase project:** `jjetohlgafuxmsdyqrnb`
- **Owner Supabase user id:** `13cdf882-eebf-464b-81e5-c3dcb8534cf3`
- **LLM:** `gpt-4o-mini` via `OPENAI_API_KEY` in `.env.local` on the VPS
- **Stack:** Next.js 16 (App Router, **Turbopack**), Supabase (Postgres + Auth + Storage + Realtime), Tailwind v4, Zod, Lucide icons, TypeScript strict.

> ⚠️ **Next.js 16 is non-standard** — middleware is `src/proxy.ts` (not `middleware.ts`); `cookies()`/`params` are async; read `node_modules/next/dist/docs/` before assuming APIs.

---

## Conventions (IMPORTANT — follow these)
- **Commits: author = the user only.** Do **NOT** add a `Co-Authored-By: Claude` trailer. (User asked for this mid-session.)
- **Always commit + push** before giving deploy steps. Never `git push --force` to main.
- **Deploy (Linux/VPS):** `cd /var/www/social-cms && git pull && npm run build && pm2 restart social-cms`
  - Prefer `pm2 reload social-cms` (zero-downtime) over `restart` during active customer chats — a restart window makes Meta retry webhooks (caused multi-minute reply delays once).
- **Migrations:** every schema change = a new `supabase/migrations/0XX_*.sql`, run manually in the **Supabase SQL Editor**. They are NOT auto-applied.
- **Local builds don't work** — `node_modules` is a partial install (no `.bin`/typescript). The real typecheck happens in `npm run build` on the VPS. Write carefully; the user pastes build errors back.
- **Terminals:** PowerShell locally, Linux on the VPS — be explicit which.
- Replies: structured with code blocks + checklists.
- Don't switch LLM provider without approval.

---

## Latest git state
Latest commit: `575c419` — "Technician panel phase 1: passcode auth + mobile shell + Today/Bookings".

This session's work (newest → oldest), all on `main`:
```
575c419 Technician panel phase 1: passcode auth + mobile shell + Today/Bookings
35886cc Booking map: custom SVG pin (fix broken marker)
c67d89a Booking link: draggable map pin (Leaflet/OSM, no API key)
da76d14 Booking link: collect name, phone, GPS location before submit
c1c3dcb Booking no longer requires a phone (phoneless/Messenger leads)
91ab8a9 Allow public access to /book/:token (skip auth redirect)
439a272 Customer self-scheduling via public booking link
46c73bc Location column on Bookings list
98b0c48 Lead form: masonry column flow
804147a Lead form: 2-column section layout
de1f4e3 Remove unit price input (auto-derives from model)
303d03c Schedule Installation → right slide-over drawer
7cac75a Phase 5: WhatsApp reschedule availability-aware
8502005 Phase 4: booking panel picks technician availability slots
3026638 Fix slots not displaying (ambiguous bookings embed)
84bc6fb Technician module: CRUD + per-day availability editor
8ddc946 Migration 017: technicians + availability slots
d346083 Realtime push for Leads/Bookings/Messenger lists
964e675 (superseded) 8s polling for lists
7bca5b4 Auto-create a lead on first inbound (WhatsApp + Messenger)
76e18dd Per-conversation AI pause toggle on Messenger threads
c310ed7 Last chat column + chat drawer on Bookings
5e60727 Fix reschedule: deterministic handling once pending
8ff31a6 Give AI booking context (stop re-qualifying booked customers)
e79ddfe WhatsApp reschedule: confirm-first date/time update from chat
f1e41b4 Rename QR Code → S.No.; send booking confirmation via chat directly
11c1d76 Leads list = open-pipeline statuses only
dd768d2 Leads list: drop Qty/Installed/Next service, add "Added by"
932d1ae Click Last chat → inline chat drawer with reply
0fd4ac5 Enrich Leads list: Ref No, Source icon, Last chat
39db669 Show Instagram in sidebar
749eec6 Messenger inbox UI + sidebar item
(earlier this session: Messenger backend, bookings module, etc.)
```

---

## ⚠️ PENDING — run these on the VPS / Supabase (if not already done)
Confirm all migrations **011 → 019** have been run in Supabase. The most recent ones this session:
```sql
-- 013_bookings.sql, 014_messenger.sql, 015_booking_pending_reschedule.sql,
-- 016_enable_realtime.sql, 017_technicians.sql, 018_lead_booking_token.sql,
-- 019_technician_auth.sql
```
Quick re-runnable essentials if unsure:
```sql
-- 018: public booking link token
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS booking_token UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_booking_token ON public.leads(booking_token);
-- 019: technician login
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS passcode_hash TEXT;
```
Then **deploy** the latest commit (`git pull && npm run build && pm2 restart social-cms`).

Optional VPS env var: `TECH_SESSION_SECRET=<long random string>` (signs technician cookies; falls back to the service-role key if unset).

Also pending from earlier (WhatsApp template path is OFF by design): the `booking_confirmation` WhatsApp template in Meta is **not used right now** — booking confirmations are sent as **free text inside the 24h window** or **copied/sent from the chat** manually. The flag `BOOKING_WHATSAPP_AUTOSEND` in `src/services/booking/booking.constants.ts` is `false`.

---

## Data model (key tables, migrations 011–019)
- **`leads`** — the customer pipeline. Status enum: `new, contacted, qualified, quoted, won, lost, scheduled, installed, in_service`. Source enum includes `manual, whatsapp_ai, facebook, instagram, …`. Has `whatsapp_conversation_id`, `messenger_conversation_id`, `location_lat/lng/url/address`, `qr_code` (labelled "S.No." in UI), `booking_token` (for public link), `installed_by`.
- **`bookings`** (013) — one active booking per lead. `booking_ref` (e.g. `SADA-2026-0001`), `scheduled_at`, `slot_label`, product/qty/price snapshots, `status` (`scheduled, confirmed, completed, cancelled, no_show`), `technician`(text), `technician_id`, `slot_id`, `pending_reschedule_at` (015), WhatsApp confirmation tracking.
- **`technicians`** (017) — `name, phone, is_active, passcode_hash`(019).
- **`technician_slots`** (017) — per-day availability blocks: `technician_id, slot_date, start_time, end_time, booking_id` (null = free; capacity 1). `next_booking_serial()` + `next_lead_serial_no()` functions exist.
- **`whatsapp_conversations` / `whatsapp_messages`** (008) and **`messenger_conversations` / `messenger_messages`** (014) — chat inboxes (RLS per owner). `ai_paused` per conversation.
- **`whatsapp_automation_configs`** (008/012) — the **one AI config** shared by WhatsApp AND Messenger (enabled, auto_reply, system_prompt, signature, product_images).
- Realtime (016) enabled on leads/bookings/whatsapp_*/messenger_* (publication `supabase_realtime`).

---

## What's built & working (high level)
1. **Multi-channel AI inbox** — WhatsApp (built earlier) + **Messenger** (this session: webhook, send, AI auto-reply reusing the SA'DA prompt, inbox at `/messenger`, per-chat AI pause). Instagram DM pipeline exists but **not wired to leads** yet. Inbound messages **auto-create a `new` lead** with a source flag (WhatsApp + Messenger).
2. **Leads** (`/leads`) — shows only open-pipeline statuses; columns: #, Date, **Ref No** (client_code or `LD-####`), Client, **Source icon**, **Last chat** (click → inline chat drawer to read + reply), Type, Unit, **Added by** (user name / "AI Bot"), Location, Status. 2-column masonry form on the lead detail page. Realtime updates.
3. **Bookings** (`/bookings`) — list with Ref, Installation, Customer, Last chat (chat drawer), Product, Total, Technician, **Location** (Map link), Status. Stats cards. Realtime.
4. **Scheduling** — on a lead, **"Schedule Installation"** opens a **right slide-over** → pick **technician → date → open 1-hr slot** (claims the slot, race-safe). Price auto-derives from the model catalog (`src/lib/products.ts`). Confirmation message is generated; can **Send on WhatsApp/Messenger** or **Copy**.
5. **WhatsApp reschedule (availability-aware)** — a booked customer replying with a new time: bot checks that technician's open slots → confirm-first ("reply YES"), offers open slots if the time is taken, claims/frees slots on confirm.
6. **Technician module** (`/technicians`, admin) — add technicians, per-day availability (single slot or "Generate hourly"), booked slots shown amber, **set login passcode**.
7. **Customer self-scheduling** — public **`/book/:token`** page (no login). Customer enters **name, phone**, captures **GPS location on a draggable Leaflet map** (required), picks a date + open 1-hr slot → books any free technician slot; lead is updated with their details + location. Admin shares the link via **"Send booking link"** (chat or copy) on the lead.

---

## 🚧 CURRENT FOCUS — Technician Panel (mobile field app at `/tech`)
**Goal:** a mobile-first panel where technicians log in, see their schedule, today's + all jobs with full customer details, update job status, and **upload site photos** (before/after) like field-service software.

**Decisions (locked, all the recommended option):**
1. Auth = **phone + passcode** (admin-set), signed cookie session — NOT Supabase auth.
2. Status flow = **rich + timestamps**: On my way → Arrived → Completed / No-show.
3. Photos = **before/after + gallery**, optional "require photo to mark Completed".
4. Technician can change **status + photos + notes only** — customer data/scheduling stays admin-controlled (read-only for techs).

**Build phases:**
- ✅ **Phase 1 (DONE, commit `575c419`)** — passcode auth (`src/lib/tech-auth.ts`, scrypt + signed cookie), `/api/v1/tech/login` + `/logout`, middleware allows public `/tech`, `/tech/login` page, gated mobile shell (`src/components/tech/tech-shell.tsx`, top bar + bottom nav), **Today** (`/tech`) and **All bookings** (`/tech/bookings`) job lists (tap-to-call, open-in-Maps, status badge), `/tech/schedule` stub, admin passcode setter on the Technicians page.
- ⬜ **Phase 2** — Job **detail** screen (`/tech/bookings/[id]`): full customer info, map, scope/notes, action area.
- ⬜ **Phase 3** — **Status updates + timestamps** (On my way → Arrived → Completed/No-show; add `arrived_at`, `completed_at`, `completion_notes` to bookings + statuses `on_the_way`, `arrived` to the bookings CHECK). Feeds back to admin Bookings.
- ⬜ **Phase 4** — **Site photo upload** (before/after): new `booking_photos` table + Supabase Storage bucket `booking-photos`; tech uploads from phone; admin sees the gallery on the booking. Optional require-photo-to-complete.
- ⬜ **Phase 5** — Technician **calendar/schedule** view (replace the stub).

**Next action:** build Phase 2 (job detail), then 3 (status), then 4 (photos), then 5 (calendar). Keep each phase a separate commit; mobile-first; tech queries are scoped to `session.tid` (technician id) + `session.uid` (owner) via the admin client (RLS bypassed, gated by the tech cookie).

---

## Key file paths
**Bot / chat**
- `src/services/whatsapp/auto-reply.service.ts` — WhatsApp pipeline (AI reply, lead auto-create, reschedule engine)
- `src/services/messenger/auto-reply.service.ts` — Messenger pipeline
- `src/services/platforms/whatsapp/whatsapp.{service,constants,types}.ts` — WhatsApp Cloud API + AI JSON contract (`WHATSAPP_AI_JSON_CONTRACT`)
- `src/services/platforms/messenger/messenger.{service,constants,types}.ts`
- `src/app/api/v1/{whatsapp,messenger}/webhook/route.ts`
- `src/app/api/v1/{whatsapp,messenger}/conversations/[conversationId]/(route|messages/route).ts` — GET history / POST reply / PATCH ai_paused
- `SADA_H2O_SYSTEM_PROMPT.md` — the AI prompt (pasted into the `/whatsapp` UI config)

**Bookings / scheduling**
- `src/services/booking/booking.service.ts` — create/update booking, slot claim/free, confirmation
- `src/services/booking/booking.constants.ts` — message builders, `BOOKING_WHATSAPP_AUTOSEND`
- `src/lib/products.ts` — SA'DA catalog (name→price, aliases, `defaultPriceForModel`)
- `src/components/bookings/{schedule-booking-panel,booking-drawer,send-booking-link-button,bookings-table}.tsx`
- `src/app/api/v1/bookings/(route|[bookingId]/route).ts`

**Technicians + self-scheduling**
- `src/components/technicians/technicians-manager.tsx`, `src/app/api/v1/technicians/**`
- `src/app/book/[token]/page.tsx` + `src/components/booking-link/{customer-booking,location-picker}.tsx` (Leaflet map)
- `src/app/api/v1/book/[token]/(route|slots/route).ts`

**Technician panel**
- `src/lib/tech-auth.ts`, `src/app/api/v1/tech/{login,logout}/route.ts`
- `src/app/tech/login/page.tsx`, `src/app/tech/(app)/{layout,page,bookings/page,schedule/page}.tsx`
- `src/components/tech/{tech-shell,job-card}.tsx`

**Infra**
- `src/proxy.ts` + `src/lib/supabase/middleware.ts` — auth redirect; public paths: `/login,/signup,/auth,/api,/book,/tech,/`
- `src/lib/supabase/{client,server,admin}.ts`, `src/lib/api-response.ts`, `src/lib/chat-info.ts`
- `src/components/realtime-refresh.tsx` — Supabase Realtime push for list pages

---

## Known limitations / notes
- WhatsApp/Messenger free-text replies only deliver inside Meta's **24-hour window**; outside it needs an approved template (not used — copy/paste or template flag is off).
- Booking confirmation auto-send is **off** (`BOOKING_WHATSAPP_AUTOSEND=false`); operators send via chat or copy.
- Instagram DM → lead is **not wired** (no `instagram_conversation_id` on leads yet).
- Public `/book/:token` link is no-login, token-gated (Calendly-style). No expiry/one-time-use yet.
- The booking link map uses **Leaflet + OpenStreetMap via CDN** (no API key); if offline it won't render.
- Lead auto-creation happens on **new inbound** only (no retroactive backfill of old chats).
