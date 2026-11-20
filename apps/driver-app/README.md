# EPYC Driver app (iPhone and Android)

A Capacitor shell around the driver portal. The app opens
https://www.epyccs.com/driver/jobs, so every driver screen stays one codebase
with the website. Native plugins add what a phone browser cannot do:

- Location while the phone is locked during a delivery
  (@capacitor-community/background-geolocation). iPhone shows the blue
  location pill; Android shows an ongoing "Epyc delivery in progress"
  notification. Sharing starts when the driver accepts a job and stops when
  the delivery is done. The web side is apps/web/lib/native-app.ts and
  components/driver/LocationSharing.tsx.
- Haptics for new job offers and location problems (@capacitor/haptics),
  since iPhone browsers cannot vibrate.
- Camera for pickup and delivery photos (the web file inputs open the camera;
  permission text is in Info.plist and AndroidManifest.xml).
- Splash screen and app icons from apps/web/store-assets.

App id: `com.epyccs.driver`. Name: `EPYC Driver`.

## Build on the Mac

You need Xcode (iPhone) and Android Studio (Android).

```
cd apps/driver-app
pnpm install
pnpm sync            # copies config and plugins into ios/ and android/
pnpm open:ios        # opens Xcode
pnpm open:android    # opens Android Studio
```

To test against a Vercel preview instead of the live site:

```
EPYC_APP_URL=https://<preview-host>/driver/jobs pnpm sync
```

Run `pnpm sync` again after any change to capacitor.config.ts or plugins.

## Before the first store upload (Rico)

1. Apple Developer Program ($99 a year) and Google Play Console ($25 once),
   ideally as the Epyc business (needs a D-U-N-S number). A new personal Play
   account has to run a closed test with 12 testers for 14 days first.
2. Xcode: Signing and Capabilities, pick the Epyc team. Bundle id
   com.epyccs.driver. Background Modes, Location updates is already set.
3. Android Studio: Build, Generate Signed Bundle, create an upload keystore.
   Keep the keystore file and its password safe and out of git; losing it
   means a new app listing.
4. Store listings: screenshots, description, privacy policy URL
   (https://www.epyccs.com/privacy), account deletion URL
   (https://www.epyccs.com/delete-account), Apple privacy labels and Google
   Data safety (precise location, name, email, phone, photos; linked to the
   user; not sold; not used for ads).
5. Reviewer logins: run apps/web/scripts/seed-reviewer-demo.mjs with a demo
   password, then put both emails and the password in the review notes.
6. Location explanation for review: the app asks for location only while a
   delivery is in progress, so the customer and dispatch can follow it. On
   iPhone it asks "While Using" first and then "Always" so sharing continues
   with the screen locked. Google Play asks for a foreground service
   declaration (type: location) with a short video showing the explainer and
   the ongoing notification during a delivery. The app does not request
   Android's separate background location permission.

Nothing is uploaded or submitted to either store without Rico's yes.

## Later

- Push notifications for new job offers in the app need Firebase (Android)
  and an APNs key (Apple). Web push does not run inside the app.
- Android may slow web requests after about 5 minutes in the background. If
  the customer map stops moving on a long drive, send location through
  native HTTP instead of the WebView.
