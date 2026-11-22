# EPYC Driver: store listing text and screenshot plan

Draft text for the App Store and Google Play listings, ready to paste. Nothing
here has been entered in either store. Rico fills these in when the developer
accounts exist, and nothing is submitted without his yes.

Character limits are noted next to each field. Every field below fits.

## Shared facts

- App name: EPYC Driver
- Bundle id / package name: com.epyccs.driver
- Who it is for: drivers who deliver for Epyc Courier Services. It is not a
  public courier app; a driver needs an approved Epyc driver account.
- Privacy policy URL: https://www.epyccs.com/privacy
- Account deletion URL: https://www.epyccs.com/delete-account
- Support URL: https://www.epyccs.com/contact
- Support email: admin@epyccs.com
- Category: Business (both stores)
- Price: free, no in-app purchases, no ads
- Age rating: 4+ (Apple), Everyone (Google). No user-generated content shown
  to the public, no gambling, no mature content.

## Apple App Store

- Name (30): `EPYC Driver`
- Subtitle (30): `Deliveries for Epyc drivers`
- Promotional text (170):
  `Accept jobs, follow each stop, snap pickup and delivery photos, and share your location only while a delivery is in progress.`
- Keywords (100, comma separated, no spaces):
  `courier,delivery,driver,dispatch,proof of delivery,route,jobs,pickup,medical courier,logistics`
- Description (4000):

```
EPYC Driver is the app for drivers who deliver for Epyc Courier Services.

Accept and run jobs
- See new job offers with pickup, drop-off, distance and pay, and accept the ones you want.
- Follow each job step by step: on the way to pickup, picked up, on the way to drop-off, delivered.
- Open directions to the pickup or drop-off in your maps app.

Proof of pickup and delivery
- Take photos of the package at pickup and at drop-off.
- Collect a signature when the job needs one.
- Record where a package was left when nobody is home.

Location only during a delivery
- The app uses your location only while you have a job in progress, from accepting it until it is delivered.
- It keeps sharing while your phone is locked, so the customer and dispatch can follow the delivery. Your phone shows that location is in use the whole time.
- When the job is done, sharing stops. No location is collected when you have no job.
- If you lose signal, the last few points are sent when the signal returns.

Made for the road
- Large buttons, works with VoiceOver and larger text, and a vibration with every alert so you never depend on sound alone.

You need an approved Epyc driver account to sign in. To drive with Epyc, apply at epyccs.com/careers.
```

- What's New (first version): `First release.`
- Copyright: `2026 Epyc Courier Services` (use the legal business name)

### App Review notes (template)

Do not put a real password in this file or in git. Rico types it into App
Store Connect only.

```
EPYC Driver is the driver app for Epyc Courier Services. Drivers need an approved account, so we created demo accounts for review.

Driver demo login: <driver demo email>
Customer demo login (to watch the delivery live on the website): <customer demo email>
Password for both: <entered in App Store Connect only>

How to see the location feature:
1. Sign in as the driver. A demo job marked "APP REVIEW DEMO" is assigned and ready to start under Jobs.
2. Open and start the job. Before iOS asks for location, the app explains why it needs it.
3. Choose Allow While Using App. iOS then offers Change to Always Allow; this lets sharing continue with the screen locked during the delivery only.
4. Lock the phone: the blue location indicator shows while the job is in progress.
5. Mark the job delivered: location sharing stops and the indicator goes away.

Location is used only while a delivery is in progress, so the customer and our dispatch team can follow it. It is not used for ads and is not sold.
Account deletion: Profile > Delete account in the app, or https://www.epyccs.com/delete-account.
```

### App Privacy (nutrition label) answers

Data collected, all Linked to the user, none used for tracking:

| Data type | Used for |
| --- | --- |
| Precise location | App functionality (live delivery tracking, route record) |
| Name | App functionality, account |
| Email address | App functionality, account |
| Phone number | App functionality (customer and dispatch can reach the driver) |
| Photos | App functionality (proof of pickup and delivery) |
| User ID | App functionality |
| Other user content (signatures, delivery notes) | App functionality |

- Tracking (App Tracking Transparency): No. No data is shared with data
  brokers or used for ads.
- Crash data: only if a crash reporter is added later; none today.

## Google Play

- App name (30): `EPYC Driver`
- Short description (80): `Run Epyc delivery jobs: offers, steps, proof photos and live delivery tracking.`
- Full description (4000): same text as the Apple description above.
- App category: Business
- Contact email: admin@epyccs.com
- Website: https://www.epyccs.com

### Data safety form answers

- Does the app collect or share user data? Yes, collects. Not shared with
  third parties (service providers like hosting count as processing, not
  sharing).
- Is data encrypted in transit? Yes (HTTPS).
- Can users request deletion? Yes, https://www.epyccs.com/delete-account
- Data types collected:
  - Location: Precise location. Collected, not shared. Required for the app
    to work. Purpose: App functionality.
  - Personal info: Name, Email address, Phone number, User IDs. Purpose: App
    functionality, Account management.
  - Photos and videos: Photos. Purpose: App functionality.
- Is location collected in the background? Yes, during an active delivery,
  through a foreground service with an ongoing notification.

### Foreground service declaration (location)

Play Console > App content > Foreground service permissions.

- Type: Location
- Task description (paste):
  `While a driver has a delivery in progress, the app shares the driver's location so the customer and dispatch can follow the delivery in real time. The service starts when the driver accepts a job, shows an ongoing "Epyc delivery in progress" notification the whole time, and stops when the delivery is marked done. It is required because drivers lock their phones while driving.`
- Video (needed, 30 to 60 seconds, unlisted YouTube link): record on an
  Android phone. Show (1) starting the assigned demo job, (2) the in-app explainer,
  (3) the Android permission prompt, (4) pressing the power button and the
  ongoing notification in the shade, (5) marking the job delivered and the
  notification going away.
- The app does not request ACCESS_BACKGROUND_LOCATION, so no separate
  background location declaration is needed.

### Prominent disclosure

Shown in the app before the system prompt (components/driver/LocationSharing.tsx):

> Share your location for this job. Epyc uses your phone's location while you
> have a job in progress, from accepting it until delivery, so the customer
> and dispatch can see where the delivery is. It is not collected when you
> have no job. It keeps sharing while your phone is locked, until the delivery
> is done.

Button: "Turn on location". Link: Privacy policy.

### Content rating questionnaire

Category: Utility, productivity, communication or other. Answer No to
violence, sexual content, language, controlled substances, gambling. Shares
location with other users: Yes (the customer sees the driver's position for
their own delivery only, during the delivery). Users can interact: No public
interaction.

## Screenshot plan

The iPhone app is set to iPhone only (no iPad), so no iPad screenshots are
needed. Take every shot with the demo accounts (scripts/seed-reviewer-demo.mjs)
so no real customer name, address or phone shows.

### Sizes

| Store | Required | Size (portrait) |
| --- | --- | --- |
| Apple | 6.9 inch iPhone (iPhone 16 Pro Max, 15 Pro Max) | 1320 x 2868 (or 1290 x 2796) |
| Apple | 6.5 inch iPhone, only if 6.9 is not given | 1284 x 2778 (or 1242 x 2688) |
| Google | Phone, 2 to 8 shots | 1080 x 1920 or larger, 9:16 |
| Google | Feature graphic | 1024 x 500 PNG or JPG, no transparency |
| Google | App icon | 512 x 512 PNG (from store-assets/driver-store-icon-1024.png) |

Apple takes the largest iPhone set and scales it down for smaller phones.
Easiest way: Xcode Simulator, iPhone 16 Pro Max, File > Save Screen.

### Shot list (same order on both stores)

1. Jobs list with the demo job. Caption: "See new jobs and accept the ones you want"
2. Active job with steps (picked up stage). Caption: "Every stop, step by step"
3. Pickup photo screen with the camera. Caption: "Proof photos at pickup and drop-off"
4. Location explainer card. Caption: "Location only while a delivery is in progress"
5. Sharing notice "You can lock your phone". Caption: "Keeps the customer updated with your phone locked"
6. Delivered screen with proof. Caption: "Done. Sharing stops on its own"

Captions are optional; plain screenshots are accepted. Keep caption text at
least 4.5:1 contrast against its background.

### Feature graphic (Google)

Navy background, the app icon on the left, and "EPYC Driver" with "Deliveries
for Epyc drivers" on the right. A draft can be made from the store icon on the
Mac; it is not in the repo yet.
