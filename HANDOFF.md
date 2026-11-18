# HANDOFF

One file per repo. Overwrite it at the end of every work session (Claude Duet or
Claude Code on the Mac). Do not append or keep old copies.

Last updated: 2026-11-18, Claude Duet
Branches open:
- claude/public-requests-and-driver-apply (PR #1, open, not merged)
- claude/client-pickup-delivery-alerts (draft PR, stacked on PR #1, not merged)

## Done: PR #1 (public requests and driver apply)
- Public "Request a Delivery" form, working contact form, driver screening
  questions and resume upload, dispatch Requests inbox.
- Migration: packages/supabase/migrations/20261118000000_public_requests.sql
- Vercel preview builds. Until SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY are
  set for Preview, the preview forms cannot save or email.

## Done: client alerts branch (step 1 of the driver app plan)
- Client gets an email, and a text if they turned texts on, when a driver is
  assigned, when the package is picked up and when it is delivered.
- Each alert links to a signed public tracking page, /track/<id>/<sig>, with the
  status steps, pickup item photos, drop-off photo and signature. Medical and
  HIPAA jobs show no photos. No addresses or names on the page or in texts.
- Alerts go only to real client accounts on Epyc's own jobs (source direct or
  dispatch_app). Staff, drivers and partner jobs (curri, walmart_spark, broker,
  other) get nothing. Dispatch-made jobs use the dispatcher as customer, so
  they send nothing until a real client is set on the job.
- Each alert goes out once per job and channel (client_alerts table, unique index).
- Client Settings: the text switch now saves profiles.sms_opt_in with consent
  wording. The email and marketing switches saved columns that did not exist;
  the migration adds them.
- Migration (not run): packages/supabase/migrations/20261118000100_client_alerts.sql
- Checks: 387 vitest tests pass, tsc clean, next build passes with placeholder
  public Supabase env (the PR #1 page /dispatch/requests needs it to prerender).

## Open
- Nothing sent, no provider account made, no migration run, nothing deployed.
- packages/supabase/tests/public_requests.pglite.mjs is written but not run.
- No text opt-in on the booking form yet; clients turn texts on in Settings.
- The person receiving the package gets no texts yet (only the client who booked).
- GPS tracking needs the Expo driver app (step 2 of the plan). driver_locations
  is still never written, so the dispatch map stays empty.

## Before merging (Rico)
PR #1 first:
1. Supabase: check the live handle_new_user() still matches the phase0 version,
   then apply 20261118000000_public_requests.sql.
2. Vercel: set SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (and EPYC_OPS_EMAIL,
   EPYC_MAIL_FROM if not default) for Production and Preview; confirm epyccs.com
   is verified in Resend.
3. Preview smoke test: one delivery request and one contact message.
Then the alerts PR:
4. Apply 20261118000100_client_alerts.sql (after PR #1's migration).
5. Vercel: set CLIENT_TRACKING_SECRET (openssl rand -base64 32). Without it,
   alerts link to the client portal instead of the tracking page.
6. For texts: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER or
   TWILIO_MESSAGING_SERVICE_SID, and make sure the A2P 10DLC campaign covers
   client delivery updates.
7. Preview test with a test client account and a test driver: assign, pick up,
   deliver, and check the emails, texts and tracking page.

## Next step
Rico reviews PR #1 and merges it, then reviews the alerts draft PR. After that:
step 2 of the plan, the Expo driver app with background GPS.
