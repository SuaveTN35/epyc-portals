# Accessibility checklist (WCAG 2.2 AA)

Last checked: 2026-11-20, PR 7 (claude/driver-app-test-run).

## Automated results
- axe-core 4.10.3, rule tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa.
- Component tests (`pnpm --filter epyc-web exec vitest run components/__a11y__`):
  driver location notice (sharing, denied, explainer), customer live tracking
  card, delete account form. 0 violations.
- Public pages, built and served locally, scanned with axe in jsdom:
  /, /about, /contact, /request-delivery, /careers, /privacy, /terms, /track,
  /delete-account, /account-deleted, /client/login, /client/register,
  /driver/login, /driver/register, /dispatch/login. Before fixes: 31 issues
  (menu button with no name, social links with no name, unlabeled file
  pickers). After fixes: 0.
- jsdom has no layout, so color contrast is checked by the WCAG formula in
  the component test file instead (every pair used by the new screens is
  4.5:1 or better).
- Signed-in screens need a database to render, so they were checked by a code
  scan for icon-only controls with no name: 7 fixed (client phone menu,
  dispatch back links and refresh buttons, driver document link).

## Checklist
| Requirement | Status |
| --- | --- |
| Every control has a name screen readers read (4.1.2) | Done on new screens and all public pages; code scan fixes on signed-in screens |
| Status changes announced without moving focus (4.1.3) | Driver location notice, new job offers, customer tracking headline use live regions |
| Nothing relies on sound alone (1.3.3) | New job offers and location problems are shown on screen and vibrate (Android; iPhone browsers cannot vibrate, the native app adds haptics) |
| Text contrast 4.5:1 (1.4.3) | Checked by formula for new screens |
| Text scaling to 200% (1.4.4) | New screens use rem sizes (text-base and up), no fixed heights on text |
| Target size 24 px minimum, 44 px used (2.5.8) | New buttons and the client phone menu are 44 px |
| Keyboard and focus order (2.1.1, 2.4.3) | New controls are native buttons, links and inputs in reading order; the delete form moves focus to its field when it opens; focus rings visible |
| Map has a text alternative (1.1.1) | Live map is labelled, with a text headline and a Google Maps link |
| Captions for video (1.2.2) | No video on the site or in the app today; any added video needs captions |
| Location permission explained before the phone asks | Explainer card on the driver job screen |

## Still to do
- Run axe in a real browser on the signed-in screens with test data (needs the
  preview database): client dashboard, quotes, payments, driver jobs, profile,
  dispatch.
- Client Settings has "Change" (email, password) and "Enable" (two-factor)
  buttons that do nothing. Wire them up or remove them.
- Manual pass with VoiceOver (iPhone) and TalkBack (Android) once the native
  shell exists.
