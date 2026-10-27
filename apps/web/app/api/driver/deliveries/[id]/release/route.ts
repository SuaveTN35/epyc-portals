import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getCallerDriver } from '@/lib/server/driver-session';
import {
  RELEASABLE_STATUSES,
  isReleasable,
  parseReleaseRequest,
  releaseEventNote,
} from '@/lib/driver-job';

/**
 * POST /api/driver/deliveries/:id/release   body: { reason, note }
 *
 * The assigned driver gives a job back before pickup. The deliveries guard
 * trigger blocks drivers from changing driver_id, so this runs with the
 * service client after checking that the caller owns the job. The job
 * returns to 'booked' for dispatch to re-offer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(`release:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  const { id: deliveryId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = parseReleaseRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const caller = await getCallerDriver();
  if (!caller) {
    return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  }
  const { admin, driver, userId } = caller;
  if (!driver) {
    return NextResponse.json({ error: 'No driver account' }, { status: 403 });
  }

  const { data: delivery } = await admin
    .from('deliveries')
    .select('id, status, driver_id')
    .eq('id', deliveryId)
    .maybeSingle();

  if (!delivery || delivery.driver_id !== driver.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  if (!isReleasable(delivery.status)) {
    return NextResponse.json(
      { error: 'A job can only be released before pickup. Call dispatch.' },
      { status: 409 }
    );
  }

  // Conditional: still this driver's and still before pickup.
  const { data: released, error: releaseError } = await admin
    .from('deliveries')
    .update({ driver_id: null, status: 'booked', assigned_at: null })
    .eq('id', deliveryId)
    .eq('driver_id', driver.id)
    .in('status', [...RELEASABLE_STATUSES])
    .select('id');

  if (releaseError) {
    return NextResponse.json({ error: `Could not release: ${releaseError.message}` }, { status: 500 });
  }
  if (!released || released.length === 0) {
    return NextResponse.json({ error: 'The job changed. Refresh and try again.' }, { status: 409 });
  }

  const followUps = await Promise.all([
    admin
      .from('drivers')
      .update({ current_delivery_id: null })
      .eq('id', driver.id)
      .eq('current_delivery_id', deliveryId),
    admin.from('delivery_events').insert({
      delivery_id: deliveryId,
      event_type: 'driver_released',
      old_status: delivery.status,
      new_status: 'booked',
      notes: releaseEventNote(parsed.reason, parsed.note),
      created_by: userId,
    }),
  ]);
  const failed = followUps.map((r) => r.error?.message).filter(Boolean);
  if (failed.length > 0) {
    console.error('release follow-up failed', { deliveryId, failed });
  }

  return NextResponse.json({ ok: true, warnings: failed });
}
