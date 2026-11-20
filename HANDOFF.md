# HANDOFF

One file per repo. Overwrite it at the end of every work session (Claude Duet or
Claude Code on the Mac). Do not append or keep old copies.

Last updated: 2026-11-20, Claude Duet

## Where things stand
- main: PR #1 (public requests, driver apply) is merged and live. PRs #5 and #6
  (Turnstile on public forms) are merged. Another Duet thread owns the live
  site's Turnstile and redeploy; do not touch production env vars or deploys.
- PR #2 (draft) claude/client-pickup-delivery-alerts -> main. Client email/text
  alerts at assigned, picked up, delivered, plus the signed /track/<id>/<sig>
  page. main merged in on Nov 20 (email.ts kept both functions). Its migration
  packages/supabase/migrations/20261118000100_client_alerts.sql is NOT applied,
  so alerts return not_ready and send nothing.
- PR #7 (draft) claude/driver-app-test-run -> claude/client-pickup-delivery-alerts.
  Driver GPS while on a job and live customer tracking. Vercel preview built.

## Done in PR #7
- POST /api/driver/location: signed-in driver only, rate limited, checks the job
  is theirs and live, writes driver_locations and drivers.current_lat/lng.
  Uses the existing driver_locations table and RLS; no migration.
- components/driver/LocationSharing.tsx on the driver job screen: watches GPS
  while the job is live, sends a fix at most every 10 s (25 m move) or 60 s,
  keeps the screen awake, shows a visual notice and vibrates on problems.
- GET /api/client/deliveries/[id]/live: the job's owner only; driver position
  only while live and under 15 minutes old.
- components/delivery/LiveDeliveryTracker.tsx on the client job page: polls every
  15 s while visible, map with driver dot, refreshes the page on status change.
- /track page refreshes every 30 s until finished. Dispatch Live Map shows the
  latest fix per driver instead of every fix.
- Accessibility: axe-core (dev dependency) tests in
  components/__a11y__/live-tracking.a11y.test.tsx, WCAG 2.0-2.2 A/AA tags,
  0 violations, plus contrast checks for the colors used.
- Test script for Rico: docs/driver-app-test-script.md.

## Open
- Preview needs SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  for the map) set for Preview in Vercel before the test works end to end.
- Web location only works while the driver's job screen is open.
- App store work not started in code. Recommended route: Capacitor wrapping the
  driver portal (native background location with a visible notification,
  camera, push, haptics). Waiting on Rico's yes before adding the app shell.
- Store items still to build: privacy policy section on location and account
  deletion, in-app account deletion, location explanation screen, reviewer demo
  accounts seed script (do not run live), icons and splash.
- Rest of the website still needs a WCAG 2.2 AA audit.
- Nothing merged, deployed, migrated or sent. No provider, Apple or Google
  accounts made. Rico registers store accounts himself, ideally under Epyc.

## Next step
Rico runs the test script on the PR #7 preview. Then the store items above.
