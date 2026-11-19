# HANDOFF

One file per repo. Overwrite it at the end of every work session (Claude Duet or
Claude Code on the Mac). Do not append or keep old copies.

Last updated: 2026-11-18, Claude Duet
Branch: claude/public-requests-and-driver-apply (PR #1, open, not merged)

## Done on this branch
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

## Open
- Vercel preview for PR #1 now builds (link is on the PR). Until
  SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY are set for Preview, the preview
  forms cannot save or email. Preview not opened from Duet (no access).
- packages/supabase/tests/public_requests.pglite.mjs is written but not run.

## Before merging (Rico)
1. Supabase: check the live handle_new_user() still matches the phase0 version
   (select pg_get_functiondef('public.handle_new_user'::regproc);), then apply
   20261118000000_public_requests.sql.
2. Vercel: set SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (and EPYC_OPS_EMAIL,
   EPYC_MAIL_FROM if not default) for Production and Preview; confirm epyccs.com
   is verified in Resend.
3. Preview smoke test: send one delivery request and one contact message, check
   both reach admin@epyccs.com and show in /dispatch/requests, then mark them spam.

## Next step
Rico reviews PR #1, does the three steps above, then merges (merging deploys).

## Also under way
Driver app plan (GPS tracking, client pickup alerts, package photos) is being
planned in a separate task. Nothing for it is in this repo yet.
