# Driver app: App Store and Google Play readiness

## Packaging: Capacitor around the driver portal (built)
Rico said yes on Nov 20, 2026. The shell is in apps/driver-app (see its
README for Mac build steps).

Wrap the existing Next.js driver portal (/driver) in a Capacitor shell for iOS
and Android, and add native plugins where the web cannot do the job.

- Reuses every driver screen already built and tested; one codebase for web
  and both stores.
- Native background location while a job is in progress:
  - Android: a foreground service with a persistent "Epyc delivery in
    progress" notification. No ACCESS_BACKGROUND_LOCATION; Play asks for a
    foreground service (location) declaration with a short video instead.
  - iOS: asks "While Using", then "Always" so sharing continues with the
    screen locked (the blue location indicator shows). Review notes must say
    location is used only while a delivery is in progress.
- Camera for pickup and delivery photos and haptics (iPhone browsers cannot
  vibrate) are in. Push notifications for new offers in the app come later
  (Firebase and APNs).
- Apple guideline 4.2 (minimum functionality) is the main risk for wrapped
  web apps; the native location, camera, push and haptics features answer it.

Alternative: rewrite the driver app in React Native (Expo). Better native
feel, but every screen is built and tested a second time and the web and app
versions drift apart. Not recommended now.

## Store requirements
| Requirement | Status |
| --- | --- |
| Privacy policy covering location | Done: /privacy section 4 (Driver Location Data) |
| In-app account deletion | Done: Settings (customers), Profile (drivers); /api/account/delete |
| Web page for deletion requests (Google Play) | Done: /delete-account |
| Explain location use before the permission prompt | Done: driver job screen explainer |
| Location history retention | 90 days in the policy; daily purge at /api/cron/purge-locations (vercel.json). Needs CRON_SECRET set in Vercel. |
| Reviewer test logins with demo jobs | Script ready: apps/web/scripts/seed-reviewer-demo.mjs (dry run by default; not run) |
| App icon 1024 (no alpha) and splash 2732 | Done: apps/web/store-assets/ (regenerate with scripts/generate-driver-icons.mjs) |
| Permission strings | Done in apps/driver-app: iOS location (While Using and Always), camera, photo library, background mode location; Android fine and coarse location, foreground service location, notifications, camera |
| Native shell, icons, splash | Done: apps/driver-app (Capacitor 8, app id com.epyccs.driver) |
| Data safety form (Play) and privacy labels (Apple) | To fill in at submission: precise location, name, email, phone, photos; linked to the user; not sold; not used for ads |

## What Rico does (not Claude)
- Register Apple Developer ($99/yr) and Google Play Console ($25 once),
  ideally as the Epyc business with a D-U-N-S number. A new personal Play
  account must run a closed test with 12 testers for 14 days first.
- Confirm the retention wording (90 days for location, delivery records kept
  as tax and legal rules require).
- Choose the demo password and run the seed script against the right database.

## Proposed permission wording
- iOS location: "Epyc shares your location with dispatch and the customer
  while you have a delivery in progress, so they can follow it."
- iOS camera: "Take pickup and delivery photos as proof of delivery."
- iOS photo library: "Attach a photo of your documents or a delivery."
