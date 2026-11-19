# HANDOFF

One file per repo. Overwrite it at the end of every work session (Claude Duet or
Claude Code on the Mac). Do not append or keep old copies.

Last updated: 2026-11-19, Claude Duet
Branch: main. PR #1 merged 2026-11-19 (merge 0ed710f) and live on epyccs.com.

## Done (live)
- Public "Request a Delivery" form (home page #quote and /request-delivery),
  saved to delivery_requests and emailed to ops, with an acknowledgement to the customer.
- Working contact form on /contact (contact_messages), replacing the mailto link.
- Driver signup now asks about cargo van access, experience and availability,
  and takes an optional resume (PDF or photo).
- Dispatch: new Requests inbox (/dispatch/requests); Applications page shows
  the new answers and the resume.
- Migration: packages/supabase/migrations/20261118000000_public_requests.sql
- /api/upload creates its Supabase client per request, so a build without the
  service key no longer fails (it answers 503 instead).
- Checks: 362 vitest tests pass, tsc clean, next build passes.

## Open (not checked from Duet; no Supabase or Vercel access)
1. Supabase: confirm the live handle_new_user() matched the phase0 version
   (select pg_get_functiondef('public.handle_new_user'::regproc);), then confirm
   20261118000000_public_requests.sql is applied. If not, /dispatch/requests
   says so and requests arrive by email only.
2. Vercel: confirm SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY (and
   EPYC_OPS_EMAIL, EPYC_MAIL_FROM if not default) are set for Production and
   Preview, and epyccs.com is verified in Resend. Without them the forms do not
   save or email.
3. packages/supabase/tests/public_requests.pglite.mjs is written but not run.

## Next step
Send one delivery request and one contact message on epyccs.com, check both
reach admin@epyccs.com and show in /dispatch/requests, then mark them spam.

## Also under way
Driver app plan (GPS tracking, client pickup alerts, package photos) is being
planned in a separate task. Nothing for it is in this repo yet.
