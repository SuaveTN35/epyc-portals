import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getCallerDriver } from '@/lib/server/driver-session';
import { isLiveTrackingStatus, parseLocationBody } from '@/lib/live-location';

/**
 * POST /api/driver/location   { deliveryId?, lat, lng, accuracy?, speed?, heading?, recordedAt? }
 *
 * The driver's phone sends its position here while a job is active (the
 * driver job screen does this on its own, throttled to one fix every 10 to 60
 * seconds). The driver is always the signed-in user; a driver id in the body
 * is ignored. A fix for a job that is not this driver's, or that is no longer
 * active, is refused with stop: true so the phone stops sharing.
 *
 * Writes one driver_locations row (dispatch live map, customer tracking) and
 * the driver's current_lat/current_lng (used to rank job offers by distance).
 */
export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Location sharing is not set up' }, { status: 503 });
  }

  const caller = await getCallerDriver();
  if (!caller) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  if (!caller.driver) return NextResponse.json({ error: 'No driver account', stop: true }, { status: 403 });

  // Per driver, not per IP: a fleet behind one carrier IP must not share a budget.
  const rate = checkRateLimit(`driver-location:${caller.driver.id}`, { limit: 20, windowSeconds: 60 });
  if (!rate.success) return NextResponse.json({ error: 'Too many updates' }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
  }
  const parsed = parseLocationBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const fix = parsed.value;
  const { admin } = caller;

  if (fix.deliveryId) {
    const { data: job } = await admin
      .from('deliveries')
      .select('id, driver_id, status')
      .eq('id', fix.deliveryId)
      .maybeSingle();
    if (!job || job.driver_id !== caller.driver.id || !isLiveTrackingStatus(job.status)) {
      return NextResponse.json({ ok: false, stop: true });
    }
  }

  const { error } = await admin.from('driver_locations').insert({
    driver_id: caller.driver.id,
    delivery_id: fix.deliveryId,
    lat: fix.lat,
    lng: fix.lng,
    speed: fix.speed,
    heading: fix.heading,
    // A fix sent late after the phone was offline keeps its real time.
    ...(fix.recordedAt ? { recorded_at: fix.recordedAt } : {}),
  });
  if (error) {
    console.error('[driver-location] insert failed:', error.message);
    return NextResponse.json({ error: 'Could not save location' }, { status: 500 });
  }

  // A late fix is history, not where the driver is now.
  if (fix.recordedAt) return NextResponse.json({ ok: true });

  const { error: driverError } = await admin
    .from('drivers')
    .update({ current_lat: fix.lat, current_lng: fix.lng })
    .eq('id', caller.driver.id);
  if (driverError) console.error('[driver-location] driver update failed:', driverError.message);

  return NextResponse.json({ ok: true });
}
