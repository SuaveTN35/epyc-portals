import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getCallerDriver } from '@/lib/server/driver-session';
import { packageSummary, type DriverOfferPayload } from '@/lib/job-offers';
import { loadOfferBlockReason } from '@/lib/server/driver-eligibility';

/**
 * GET /api/driver/offers - the caller's open job offers.
 *
 * RLS hides a delivery from a driver until it is assigned to them, so the
 * deliveries embed is null in the browser for an open offer. This route reads
 * with the service client and returns only what a driver needs to decide:
 * cities, windows, payout, distance, package summary. No street addresses,
 * contact names, phone numbers, or customer details before acceptance.
 */

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(`driver-offers:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  const caller = await getCallerDriver();
  if (!caller) {
    return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  }
  if (!caller.driver || caller.driver.status !== 'active') {
    return NextResponse.json({ error: 'Your driver account is not active' }, { status: 403 });
  }

  // P-366: no new offers while insurance is expired or not approved. Offers
  // already sent stay hidden (accept would be refused anyway); the screen
  // shows why. Jobs already assigned are unaffected.
  const blockedReason = await loadOfferBlockReason(caller.admin, caller.driver.id);
  if (blockedReason) {
    return NextResponse.json({ offers: [], blocked_reason: blockedReason });
  }

  const { data, error } = await caller.admin
    .from('job_offers')
    .select(
      `id, delivery_id, expires_at, created_at, estimated_payout, distance_to_pickup_miles,
       delivery:deliveries(
         status, driver_id, pickup_city, pickup_state, delivery_city, delivery_state,
         pickup_window_start, pickup_window_end, delivery_window_start, delivery_window_end,
         distance_miles, estimated_duration_minutes, package_description, package_weight,
         vehicle_required, service_level, requires_signature, requires_temperature_control
       )`
    )
    .eq('driver_id', caller.driver.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Could not load offers: ${error.message}` }, { status: 500 });
  }

  const offers: DriverOfferPayload[] = (data || [])
    .map((o: any) => ({ o, d: Array.isArray(o.delivery) ? o.delivery[0] : o.delivery }))
    // Hide offers for jobs that were taken or cancelled in the meantime.
    .filter(({ d }) => d && d.status === 'booked' && d.driver_id === null)
    .map(({ o, d }) => ({
      id: o.id,
      delivery_id: o.delivery_id,
      expires_at: o.expires_at,
      created_at: o.created_at,
      estimated_payout: o.estimated_payout != null ? Number(o.estimated_payout) : null,
      distance_to_pickup_miles:
        o.distance_to_pickup_miles != null ? Number(o.distance_to_pickup_miles) : null,
      pickup_city: d.pickup_city,
      pickup_state: d.pickup_state,
      delivery_city: d.delivery_city,
      delivery_state: d.delivery_state,
      pickup_window_start: d.pickup_window_start,
      pickup_window_end: d.pickup_window_end,
      delivery_window_start: d.delivery_window_start,
      delivery_window_end: d.delivery_window_end,
      trip_miles: d.distance_miles != null ? Number(d.distance_miles) : null,
      estimated_minutes: d.estimated_duration_minutes ?? null,
      package_summary: packageSummary(d),
      vehicle_required: d.vehicle_required ?? null,
      service_level: d.service_level ?? null,
      requires_signature: !!d.requires_signature,
      requires_temperature_control: !!d.requires_temperature_control,
    }));

  return NextResponse.json({ offers });
}
