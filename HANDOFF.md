# HANDOFF

One file per repo. Overwrite it at the end of every work session (Claude Duet or
Claude Code on the Mac). Do not append or keep old copies.

Last updated: 6--, Claude Duet
main now includes the accessibility pass (claude/accessibility-wcag, merged
on Rico's yes, fast-forward to 6b36 plus this file). Pushing main deploys
epyccs.com.

## Done (live on main)
- Public Request a Delivery form (/request-delivery and home #quote), contact
  form (/contact), driver signup with resume, dispatch Requests inbo.
- Spam limit shared across instances (rate_limit_hits table, applied in Supabase).
- Cloudflare Turnstile widget "epyccs" eists; NEXT_PUBLIC_TURNSTILE_SITE_KEY is
  set in Vercel (Production and Preview).
- Two TEST requests saved (REQ-DCA637, REQ-D8FA85B); customer confirmation
  email from noreply@epyccs.com arrives.

## Done (accessibility, WCAG . AA, merged 6--)
- Skip to main content link; <main> landmark on every public and sign-in page;
  one h per page; footer headings are h.
- Desktop Services and Login menus open by keyboard (Enter/Space, Escape closes),
  not only on hover. Mobile menu button has a name and aria-epanded.
- Social links named; decorative icons hidden from screen readers.
- Focus ring is green with a white halo so it shows on white, the dark footer
  and the gradient. Inputs that had focus:outline-none now get focus:ring-.
- Contrast: field borders gray-3 -> gray-5, placeholders gray-5, footer
  small tet gray-, white/7 and white/8 on the gradient -> white/9, small
  yellow links -> yellow-, red asterisks -> red-6/7.
- Forms: "Fields marked * are required" note, errors linked to fields, focus
  moves to the first bad field (or the error bo) after a failed send and to the
  confirmation after a good one. Hint under the submit button while waiting on
  the Cloudflare check; message with the phone number if the check fails to load.
- Track page: visible label on the tracking number field, error announced.
- Sign-up pages: autocomplete on name, phone, company and new passwords; hidden
  file inputs taken out of the tab order; remove-photo buttons named.
- scroll-padding-top so the sticky header never covers a focused field;
  reduced-motion setting respected.
- New /accessibility statement page, linked in the footer and sitemap.
- New app/not-found.ts with a real heading and a link home.
- Checks: ae-core (wcaga/aa, ., ., best practice) reports  issues on 9
  public and sign-in pages of a local production build; a class-based contrast
  check reports  failures. No real browser was available in the cloud session,
  so color contrast was checked from Tailwind classes, not rendered piels.
- 38 vitest tests pass, tsc clean, net build passes.

## Open
. Confirm the live deploy: Cloudflare check shows and verifies on /contact and
   /request-delivery, /accessibility loads. TURNSTILE_SECRET_KEY (capitals) is
   set in Vercel as Secret for Production and Preview (Rico, 6--).
. Rico: check admin@epyccs.com for the TEST alerts, then mark REQ-DCA637 and
   REQ-D8FA85B as spam on /dispatch/requests.
3. Optional: switch Production SUPABASE_SERVICE_ROLE_KEY in Vercel to Secret type.
. Signed-in dashboards (client, driver, dispatch) were not part of the
   accessibility pass.

## Net step
Check the live forms after the deploy; then the dashboards accessibility pass if
Rico wants it.

## Also under way
Driver app and the end-to-end test script are in the "Plan the Epyc driver app"
task (PR # is a draft there).
