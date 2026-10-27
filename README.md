# EPYC Courier Service Portals

A multi-portal delivery management platform for EPYC Courier Service (UDIG Solutions Inc), Southern California's premier same-day courier service.

## Portals

| Portal | URL | Description |
|--------|-----|-------------|
| **Client Portal** | `localhost:3000` | Customer-facing portal for booking, tracking, and managing deliveries |
| **Driver Portal** | `localhost:3001` | Driver app for onboarding, accepting jobs, and managing earnings |
| **Dispatch Portal** | `localhost:3002` | Internal dashboard for dispatchers to manage deliveries and drivers |

## Tech Stack

- **Framework:** Next.js 15 with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS with EPYC brand colors
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (driver documents)
- **Monorepo:** Turborepo with pnpm workspaces

## Project Structure

```
epyc-portals/
├── apps/
│   ├── client-portal/     # Customer portal (port 3000)
│   ├── driver-portal/     # Driver portal (port 3001)
│   └── dispatch/          # Dispatch dashboard (port 3002)
├── packages/
│   ├── shared/            # Shared types, constants, utilities
│   └── supabase/          # Database migrations
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SuaveTN35/epyc-portals.git
   cd epyc-portals
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run database migrations in Supabase SQL Editor (files in `packages/supabase/migrations/`)

5. Start the development servers:
   ```bash
   pnpm dev
   ```

## Features

### Client Portal
- User registration and authentication
- Request delivery quotes
- Book same-day deliveries
- Real-time package tracking
- Delivery history and management
- Payment management

### Driver Portal
- Driver application and onboarding
- Document upload (license, insurance, vehicle photos)
- Vehicle registration with dimensions and cargo capacity
- Job board with available deliveries
- Active delivery management
- Earnings tracking and history
- Proof of delivery capture

### Driver App (installable, P-352 Phase 3)

The driver portal installs to a phone home screen as "EPYC Driver" (a PWA; no app store).

- Manifest: `apps/web/public/driver.webmanifest` (start `/driver/jobs`, scope `/driver/`,
  standalone). It is linked only from `apps/web/app/driver/layout.tsx`, so marketing and
  customer pages never offer an install.
- Icons: `apps/web/public/icons/driver-*.png`, regenerated with
  `node apps/web/scripts/generate-driver-icons.mjs` (uses the sharp that ships with next).
- Service worker: `apps/web/public/driver-sw.js`, scope `/driver/`, registered in production
  only. Driver page loads are network only; when offline it shows `/driver/offline`. Only
  `/_next/static/*` and `/icons/*` are cached. It never caches signed-in pages, `/api/*`,
  `/auth/*`, Next.js RSC data, POSTs, or any Supabase or other cross-origin request. Bump
  `CACHE_VERSION` in the file to clear every phone's cache on the next visit.
- Install card on `/driver/jobs` (one tap on Android Chrome; Share -> Add to Home Screen ->
  Add on iPhone) and an "Install on your phone" section on `/driver/help`.

What works where:

| | Android (Chrome) | iPhone (Safari) |
|---|---|---|
| Install to home screen | Yes, one-tap prompt | Yes, by the 3 Share-menu steps (no prompt API on iOS) |
| Full screen, own icon | Yes | Yes |
| Offline page | Yes | Yes |
| Web push job alerts | Yes, once Phase 3b is done | iOS 16.4+ and only after Add to Home Screen |
| Background GPS | No | No |

A web app cannot track location or run in the background once closed. Location is captured
only while the driver has the app open on an active job.

#### Web push: groundwork done, sending not built (Phase 3b)

Done: the `push_subscriptions` table (migration `20261028000100_push_subscriptions.sql`,
RLS own rows only), the "Turn on job alerts" button (shown only in the installed app and only
when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set), saving the phone's subscription, and the service
worker `push` / `notificationclick` handlers. Payload shape: `{ "title", "body", "url", "tag" }`;
`url` must be a `/driver/...` path, anything else opens `/driver/jobs`.

Still to do in Phase 3b:

- Generate a VAPID key pair (for example `npx web-push generate-vapid-keys`) and set:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - public key, shipped to the browser. The alerts button stays
    hidden until this is set (it is read at build time, so redeploy after setting it).
  - `VAPID_PRIVATE_KEY` - server only, never `NEXT_PUBLIC_`.
  - `VAPID_SUBJECT` - `mailto:` address or site URL that push services can contact.
- Server-side sender (for example the `web-push` package) that reads `push_subscriptions` with
  the service role, sends on new offer / assignment, and deletes rows on a 404 or 410 reply.
- Handle `pushsubscriptionchange`, and remove a phone's row on sign-out. Today, if two drivers
  share one phone, the second driver's insert fails on the unique endpoint until the first
  driver's row is removed.

### Driver SMS job alerts (P-352 Phase 3)

Texts go out through Twilio's REST API (`apps/web/lib/server/sms.ts`, plain `fetch`, no SDK).
Without Twilio env vars every send is a no-op that logs `SMS not configured`, and nothing fails.

| When | To | Text |
|---|---|---|
| Dispatch offers a job (`OfferJobDialog` -> `POST /api/dispatch/sms/offer`, staff only) | each offered driver | `EPYC: New job offer - <pickup city> to <drop-off city>, $<payout>. Open the app to accept: https://www.epyccs.com/driver/jobs` |
| Dispatch assigns a job directly (`POST /api/dispatch/sms/assigned`, staff only) | the assigned driver | `EPYC: You've been assigned a job. Open: https://www.epyccs.com/driver/delivery/<id>` |
| Driver reports a problem (`POST /api/driver/deliveries/<id>/problem-alert`) | `EPYC_OPS_SMS` | reason label and job reference only; the driver's note is never sent |

Rules built in:

- Drivers are texted only when `profiles.sms_opt_in` is true. They opt in with the unticked
  checkbox on the last onboarding step, or later on their Profile page. Consent text: "Text me
  job offers and updates. Msg and data rates may apply. Reply STOP to opt out."
  `profiles.sms_opt_in_at` is stamped by a database trigger when consent is given.
- No customer names, street addresses, or medical details in any text: cities, payout, and links only.
- The first text a number ever receives ends with "Reply STOP to opt out."
- Every attempted send is logged in `sms_log` (staff can read; only the server writes). If Twilio
  reports the driver replied STOP (error 21610), `sms_opt_in` is switched off.
- The same text is not repeated to the same driver for the same job within 10 minutes.

Environment variables (server only, never `NEXT_PUBLIC_`):

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (any US format; normalized to E.164) or `TWILIO_MESSAGING_SERVICE_SID`
  (used first when both are set)
- `EPYC_OPS_SMS` - ops phone for problem alerts; unset means no ops texts

Before going live: US carriers block or filter application texts sent from an unregistered
10-digit long code. Register the business brand and an A2P 10DLC campaign in the Twilio console
(Messaging -> Regulatory Compliance), attach the sending number to a Messaging Service on that
campaign, and set `TWILIO_MESSAGING_SERVICE_SID`. The campaign sample messages and the opt-in
description should match the texts and the consent checkbox above. A toll-free number needs
toll-free verification instead. Registration review time is set by Twilio and the carriers.

Migration: `packages/supabase/migrations/20261028000300_sms_alerts.sql`.

### Dispatch Portal
- Real-time delivery dashboard
- Driver management and approval
- Delivery assignment
- Live map view
- Analytics and reporting
- Support ticket management

## EPYC Brand Colors

```css
epyc-primary:   #047857  /* Dark Green */
epyc-secondary: #059669  /* Medium Green */
epyc-accent:    #10B981  /* Emerald highlight */
epyc-green:     #047857  /* Gradient start */
epyc-teal:      #0d7490  /* Gradient middle */
epyc-blue:      #0369a1  /* Gradient end */
```

## Database Schema

Key tables:
- `profiles` - User profiles with roles (customer, driver, dispatcher, admin)
- `drivers` - Driver information, vehicle details, documents
- `deliveries` - Delivery orders with status tracking
- `delivery_updates` - Real-time status updates and location tracking

## Scripts

```bash
pnpm dev          # Start all portals in development mode
pnpm build        # Build all portals for production
pnpm lint         # Run ESLint across all packages
```

## Contact

**EPYC Courier Service**
UDIG Solutions Inc
Website: [epyccs.com](https://epyccs.com)
Phone: (818) 217-0070

## License

Proprietary - UDIG Solutions Inc. All rights reserved.
