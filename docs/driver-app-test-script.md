# Driver app test script (preview)

Goal: one TEST delivery from booking to drop-off, checking that the customer
sees each step and the driver's location live.

You need three screens, each signed in as someone different:
- Laptop, normal window: Dispatch (your admin account).
- Laptop, private window: the test customer.
- Your phone: the test driver.

Use the preview link from the pull request on all three.

## Before you start (one time)

1. In Vercel, Preview environment: SUPABASE_SERVICE_ROLE_KEY must be set (driver
   jobs and live tracking need it). NEXT_PUBLIC_GOOGLE_MAPS_API_KEY shows the
   map; without it the card shows a Google Maps link instead.
2. The preview most likely uses the same database as epyccs.com, so put TEST in
   names and descriptions. No emails or texts go out during this test.
3. Test customer: in the private window, open /client/register and sign up with
   a second email address.
4. Test driver: on your phone, open /driver/register and sign up with a third
   email address. Finish onboarding with any photos and an insurance expiry date
   in the future.
5. Dispatch: approve the test driver in Applications, and approve the
   insurance card, so the driver can receive jobs.

## The run

1. Customer: New Delivery. Use real addresses near you and put TEST in the
   package description. Continue to the Payment screen and stop there; do not
   pay. The job is already booked. Open My Deliveries, then the job.
   - Expect: a Live tracking card that says the map appears once a driver is
     on the way.
2. Driver (phone): sign in, open Jobs, turn on Online.
3. Dispatch: open Deliveries, open the TEST job, and offer it to the test
   driver (or assign the driver directly).
4. Driver: accept the offer and open the job. Allow location when the phone
   asks.
   - Expect on the phone: a green notice, "Sharing your location with dispatch
     and the customer".
   - Expect on the customer page, within 15 seconds and without refreshing:
     "Driver on the way to pickup" and a blue dot for the driver on the map.
   - Expect on Dispatch, Live Map: one arrow for the test driver.
5. Driver: move around a little with the job screen open.
   - Expect: "Driver location updated just now" on the customer page.
6. Driver: tap Arrive at pickup, take the item photo and the receipt or note,
   then Pickup complete.
   - Expect on the customer page: "Picked up, on the way", and the timeline
     updates by itself.
7. Driver: Arrive at drop-off, take the placement photo, enter who received it,
   get a signature, then Complete delivery.
   - Expect on the customer page: Delivered, the live card goes away, and proof
     of delivery shows the photo and signature.
   - Expect on the phone: the location notice goes away.

## Known limits of the web version

- Location is shared only while the Epyc job screen is open on the driver's
  phone (the screen is kept awake). Switching to Google Maps for directions
  pauses updates until the driver comes back. The app store version fixes this.
- If a step does not match what is written here, note the step number and what
  you saw.
