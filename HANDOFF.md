# HANDOFF

One file per repo. Overwrite it at the end of every work session (Claude Duet or
Claude Code on the Mac). Do not append or keep old copies.

Last updated: 2026-11-20, Claude Duet
Branch for this session: claude/epyc-courier-rates-2026-11 (draft PR, not merged).
main is at e7e081a (PRs 1 and 3-6 merged). Open drafts: PR 2 (client alerts),
PR 7 (driver GPS test preview).

## Done this session (draft PR, waiting on Rico)
- New customer rates in packages/shared (VEHICLE_CONFIG + calculateQuote),
  from the 2026-11-20 competitor check (project file epyc/pricing-2026-11-20.md):
  car $20 + $1.25/mi, min $35; SUV $25 + $1.75/mi, min $45;
  cargo van/Sprinter $45 + $2.25/mi, min $85. Pickup and box truck unchanged.
- Priority 1.3x and Rush 1.8x now charged once. Before, Rush added 30% on top
  of 1.8x (about 2.34x).
- Medical +$15 and temperature +$25 stay flat (no longer multiplied by rush).
- New: after hours +$25 (pickup before 7 AM or from 6 PM Pacific) and
  weekends +50%, by booking time. calculateQuote takes an optional
  { pickupAt } third argument; without it there are no time charges.
- New quote fields: minimum_adjustment, after_hours_surcharge,
  weekend_surcharge. Shown in both quote breakdowns. They have no deliveries
  columns, so the stored row keeps total_price as the source of truth.
- Tests: apps/web/lib/pricing.test.ts (21 tests). Full vitest 403 pass; tsc
  clean for web, client-portal, driver-portal, dispatch. next build not run.

## Open
1. Rico to review and approve the draft PR before merge.
2. Not changed (Rico to decide): weight surcharge still applies to vans
   ($5 per 25 lb over 50 lb); MULTI_STOP_PRICING / calculateMultiStopTrip
   left as is (no page calls them); pickup truck and box truck prices are
   below market; holidays are not charged as weekends.
3. From before: Turnstile secret key and Supabase service key in Vercel, then
   redeploy and test the public forms.

## Next step
Rico reads the PR. If approved, merge, let Vercel deploy, and book one test
quote at 20 miles in a van (expect $90 on a weekday daytime).
