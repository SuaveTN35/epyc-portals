# HANDOFF

One file per repo. Overwrite it at the end of every work session (Claude Duet or
Claude Code on the Mac). Do not append or keep old copies.

Last updated: 2026-11-20, Claude Duet
Branch: claude/accessibility-wcag22 (not merged). main is live on epyccs.com
at e7e081a (PR #6, Turnstile on the public forms).

## Done (live on main)
- Public Request a Delivery form (/request-delivery and home #quote), contact
  form (/contact), driver signup with resume, dispatch Requests inbox.
- Spam limit shared across instances (rate_limit_hits table, applied in Supabase).
- Cloudflare Turnstile widget "epyccs" exists; NEXT_PUBLIC_TURNSTILE_SITE_KEY is
  set in Vercel (Production and Preview).
- Two TEST requests saved (REQ-1DCA6237, REQ-D8FA85B2); customer confirmation
  email from noreply@epyccs.com arrives.

## Done on this branch (accessibility, WCAG 2.2 AA)
- Skip to main content link; <main> landmark on every public and sign-in page;
  one h1 per page; footer headings are h2.
- Desktop Services and Login menus open by keyboard (Enter/Space, Escape closes),
  not only on hover. Mobile menu button has a name and aria-expanded.
- Social links named; decorative icons hidden from screen readers.
- Focus ring is green with a white halo so it shows on white, the dark footer
  and the gradient. Inputs that had focus:outline-none now get focus:ring-2.
- Contrast: field borders gray-300 -> gray-500, placeholders gray-500, footer
  small text gray-400, white/70 and white/80 on the gradient -> white/90, small
  yellow links -> yellow-200, red asterisks -> red-600/700.
- Forms: "Fields marked * are required" note, errors linked to fields, focus
  moves to the first bad field (or the error box) after a failed send and to the
  confirmation after a good one. Hint under the submit button while waiting on
  the Cloudflare check; message with the phone number if the check fails to load.
- Track page: visible label on the tracking number field, error announced.
- Sign-up pages: autocomplete on name, phone, company and new passwords; hidden
  file inputs taken out of the tab order; remove-photo buttons named.
- scroll-padding-top so the sticky header never covers a focused field;
  reduced-motion setting respected.
- New /accessibility statement page, linked in the footer and sitemap.
- New app/not-found.tsx with a real heading and a link home.
- Checks: axe-core (wcag2a/aa, 2.1, 2.2, best practice) reports 0 issues on 19
  public and sign-in pages of a local production build; a class-based contrast
  check reports 0 failures. No real browser was available in the cloud session,
  so color contrast was checked from Tailwind classes, not rendered pixels.
- 382 vitest tests pass, tsc clean, next build passes.

## Open
1. Rico pastes TURNSTILE_SECRET_KEY into Vercel (Secret type, Production and
   Preview). Then redeploy production and check the Cloudflare check shows on
   /request-delivery.
2. Rico: look at the preview of this branch; merge to main only on his yes.
3. Rico: check admin@epyccs.com for the two TEST alerts, then mark both as spam
   on /dispatch/requests.
4. Optional: switch Production SUPABASE_SERVICE_ROLE_KEY in Vercel to Secret type.
5. Signed-in dashboards (client, driver, dispatch) were not part of this pass.

## Next step
After the secret key is in: redeploy, check the form, then get Rico's yes to
merge claude/accessibility-wcag22.

## Also under way
Driver app and the end-to-end test script are in the "Plan the Epyc driver app"
task (PR #2 is a draft there).
