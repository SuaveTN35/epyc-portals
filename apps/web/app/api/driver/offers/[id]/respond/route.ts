import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getCallerDriver } from '@/lib/server/driver-session';
import { evaluateOfferResponse, parseOfferAction } from '@/lib/job-offers';
import { blockedAcceptMessage, loadOfferBlockReason } from '@/lib/server/driver-eligibility';

/**
 * POST /api/driver/offers/:id/respond   body: { action: 'accept' | 'decline' }
 *
 * Drivers cannot accept through the database directly: RLS only lets a driver
 * update deliveries already assigned to them. This route checks the caller,
 * then uses the service-role client for the assignment.
 *
 * Race safety: the assignment is a conditional UPDATE
 * (driver_id IS NULL AND status = 'booked'). If two drivers accept at once,
 * exactly one UPDATE matches a row; the other gets 409 "Job already taken".
 *
 * Declining is never held against the driver: it only sets the offer status.
 *
 * Insurance (P-366): accepting is refused with 403 when the driver's
 * insurance is expired, missing, or not approved by dispatch. The database
 * enforces the same rule on the assignment (guard_new_work_insurance), so a
 * race with an expiry cannot slip through. Declining is always allowed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(`offer-respond:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  const { id: offerId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const action = parseOfferAction(body);
  if (!action) {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  const caller = await getCallerDriver();
  if (!caller) {
    return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  }
  const { admin, driver, userId } = caller;

  const { data: offer } = await admin
    .from('job_offers')
    .select('id, delivery_id, driver_id, status, expires_at')
    .eq('id', offerId)
    .maybeSingle();

  const { data: delivery } = offer
    ? await admin
        .from('deliveries')
        .select('id, status, driver_id')
        .eq('id', offer.delivery_id)
        .maybeSingle()
    : { data: null };

  const decision = evaluateOfferResponse({ action, driver, offer, delivery });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.httpStatus });
  }
  // evaluateOfferResponse guarantees these for an ok decision.
  const driverId = driver!.id;
  const deliveryId = offer!.delivery_id;
  const now = new Date().toISOString();

  if (action === 'accept') {
    const blocked = await loadOfferBlockReason(admin, driverId);
    if (blocked) {
      return NextResponse.json({ error: blockedAcceptMessage(blocked), blocked_reason: blocked }, { status: 403 });
    }
  }

  if (action === 'decline') {
    const { error } = await admin
      .from('job_offers')
      .update({ status: 'rejected', responded_at: now })
      .eq('id', offerId)
      .eq('status', 'pending');
    if (error) {
      return NextResponse.json({ error: `Could not decline: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action });
  }

  // Accept. The only race-critical step: whoever matches the row wins.
  const { data: won, error: assignError } = await admin
    .from('deliveries')
    .update({ driver_id: driverId, status: 'assigned', assigned_at: now })
    .eq('id', deliveryId)
    .is('driver_id', null)
    .eq('status', 'booked')
    .select('id');

  if (assignError) {
    if (assignError.code === '42501') {
      // guard_new_work_insurance refused it (insurance or required items changed in the meantime).
      return NextResponse.json({ error: blockedAcceptMessage('insurance or required items are not in order') }, { status: 403 });
    }
    return NextResponse.json({ error: `Could not accept: ${assignError.message}` }, { status: 500 });
  }
  if (!won || won.length === 0) {
    await admin
      .from('job_offers')
      .update({ status: 'expired' })
      .eq('id', offerId)
      .eq('status', 'pending');
    return NextResponse.json({ error: 'Job already taken' }, { status: 409 });
  }

  // Follow-up writes. The job is already this driver's; collect failures so
  // dispatch can see them, but do not undo the assignment.
  const followUps = await Promise.all([
    admin
      .from('job_offers')
      .update({ status: 'accepted', responded_at: now })
      .eq('id', offerId),
    admin
      .from('job_offers')
      .update({ status: 'expired' })
      .eq('delivery_id', deliveryId)
      .eq('status', 'pending')
      .neq('id', offerId),
    admin.from('drivers').update({ current_delivery_id: deliveryId }).eq('id', driverId),
    admin.from('delivery_events').insert({
      delivery_id: deliveryId,
      event_type: 'offer_accepted',
      old_status: 'booked',
      new_status: 'assigned',
      notes: 'Driver accepted job offer',
      created_by: userId,
    }),
  ]);
  const failed = followUps.map((r) => r.error?.message).filter(Boolean);
  if (failed.length > 0) {
    console.error('offer accept follow-up failed', { offerId, deliveryId, failed });
  }

  return NextResponse.json({ ok: true, action, delivery_id: deliveryId, warnings: failed });
}
