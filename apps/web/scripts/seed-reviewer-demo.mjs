#!/usr/bin/env node
// Creates the App Store / Google Play reviewer test logins: one demo customer
// and one demo driver, with demo jobs so a reviewer can see the whole flow
// (accept, pickup, delivery, live tracking) without real customers.
//
// Safe by default: without --run it only prints what it would do.
//
//   DEMO_PASSWORD='choose-a-strong-one' \
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node apps/web/scripts/seed-reviewer-demo.mjs            # dry run
//   node apps/web/scripts/seed-reviewer-demo.mjs --run      # writes
//
// Optional: DEMO_CUSTOMER_EMAIL, DEMO_DRIVER_EMAIL (defaults below).
// Run it again any time: it reuses the two accounts and resets their demo
// jobs. The password is never stored in the repo; put it in App Store
// Connect and Play Console review notes only.
//
// Uses the service role, so it bypasses RLS. Run it only on purpose, against
// the database the store build points at, after Rico says so.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const RUN = process.argv.includes('--run');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
const customerEmail = process.env.DEMO_CUSTOMER_EMAIL || 'appreview-customer@epyccs.com';
const driverEmail = process.env.DEMO_DRIVER_EMAIL || 'appreview-driver@epyccs.com';

const DEMO_TAG = 'APP REVIEW DEMO - not a real delivery';
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// Two points in the San Fernando Valley, a short drive apart.
const PICKUP = { address: '6801 Hayvenhurst Ave', city: 'Van Nuys', state: 'CA', zip: '91406', lat: 34.1955, lng: -118.4925 };
const DROPOFF = { address: '14500 Roscoe Blvd', city: 'Panorama City', state: 'CA', zip: '91402', lat: 34.2219, lng: -118.4501 };

function job(customerId, overrides) {
  return {
    customer_id: customerId,
    pickup_address: PICKUP.address,
    pickup_city: PICKUP.city,
    pickup_state: PICKUP.state,
    pickup_zip: PICKUP.zip,
    pickup_lat: PICKUP.lat,
    pickup_lng: PICKUP.lng,
    pickup_contact_name: 'Demo Sender',
    delivery_address: DROPOFF.address,
    delivery_city: DROPOFF.city,
    delivery_state: DROPOFF.state,
    delivery_zip: DROPOFF.zip,
    delivery_lat: DROPOFF.lat,
    delivery_lng: DROPOFF.lng,
    delivery_contact_name: 'Demo Recipient',
    package_description: DEMO_TAG,
    package_weight: 5,
    requires_signature: true,
    requires_photo_pod: true,
    is_medical: false,
    is_hipaa: false,
    distance_miles: 3.4,
    estimated_duration_minutes: 15,
    base_price: 35,
    distance_price: 0,
    total_price: 35,
    driver_payout: 25,
    service_level: 'standard',
    vehicle_required: 'car',
    ...overrides,
  };
}

function plan() {
  return [
    `Customer login: ${customerEmail} (role customer, name "App Review Customer")`,
    `Driver login:   ${driverEmail} (role driver, active, insurance approved until ${inDays(365)})`,
    'Jobs (all marked "' + DEMO_TAG + '"):',
    '  1. assigned to the demo driver, ready to start (driver flow + customer live tracking)',
    '  2. booked, no driver yet (dispatch can offer it to the demo driver)',
    '  3. delivered yesterday (history and proof of delivery screens)',
  ];
}

async function ensureUser(admin, email, fullName) {
  // listUsers pages; the demo accounts are found by exact email.
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true, ban_duration: 'none' });
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  console.log(RUN ? 'Seeding reviewer demo accounts:' : 'Dry run (add --run to write):');
  for (const line of plan()) console.log('  ' + line);
  if (!RUN) return;

  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  if (!password || password.length < 12) throw new Error('Set DEMO_PASSWORD (12+ characters)');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const must = ({ error }, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  const customerId = await ensureUser(admin, customerEmail, 'App Review Customer');
  const driverUserId = await ensureUser(admin, driverEmail, 'App Review Driver');

  must(
    await admin.from('profiles').upsert({ id: customerId, email: customerEmail, full_name: 'App Review Customer', role: 'customer' }),
    'customer profile'
  );
  must(
    await admin.from('profiles').upsert({ id: driverUserId, email: driverEmail, full_name: 'App Review Driver', role: 'driver' }),
    'driver profile'
  );

  const insurancePath = `drivers/${driverUserId}/insurance_card-demo.jpg`;
  const driverRow = {
    profile_id: driverUserId,
    license_number: 'DEMO0000',
    license_state: 'CA',
    license_expiry: inDays(365 * 3),
    vehicle_type: 'car',
    vehicle_make: 'Toyota',
    vehicle_model: 'Prius',
    vehicle_year: 2022,
    background_check_status: 'approved',
    status: 'active',
    insurance_card_url: insurancePath,
    insurance_expiry: inDays(365),
    // Inside the required-items grace window, so the demo driver can take jobs.
    items_required_from: inDays(365),
    is_online: false,
  };
  must(await admin.from('drivers').upsert(driverRow, { onConflict: 'profile_id' }), 'driver row');
  const { data: driver, error: dErr } = await admin.from('drivers').select('id').eq('profile_id', driverUserId).single();
  if (dErr) throw dErr;

  must(
    await admin.from('driver_review_items').upsert(
      { driver_id: driver.id, item: 'insurance_card', photo_path: insurancePath, status: 'approved', reviewed_at: new Date().toISOString() },
      { onConflict: 'driver_id,item' }
    ),
    'insurance review'
  );

  // Reset the demo jobs: remove earlier ones, then insert fresh.
  must(
    await admin.from('deliveries').delete().eq('customer_id', customerId).eq('package_description', DEMO_TAG),
    'old demo jobs'
  );
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  must(
    await admin.from('deliveries').insert([
      job(customerId, { status: 'assigned', driver_id: driver.id, booked_at: now, assigned_at: now }),
      job(customerId, { status: 'booked', booked_at: now }),
      job(customerId, {
        status: 'delivered',
        driver_id: driver.id,
        booked_at: yesterday,
        assigned_at: yesterday,
        actual_pickup_time: yesterday,
        actual_delivery_time: yesterday,
      }),
    ]),
    'demo jobs'
  );

  console.log('Done. Put both emails and DEMO_PASSWORD in the store review notes.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
