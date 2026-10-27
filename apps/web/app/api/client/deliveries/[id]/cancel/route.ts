import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  ALREADY_ASSIGNED_MESSAGE,
  evaluateCustomerCancel,
} from '@/lib/customer-delivery';

/**
 * POST /api/client/deliveries/:id/cancel
 *
 * The customer cancels their own delivery before a driver is assigned.
 * Customers have no UPDATE policy on deliveries and the Phase 2 guard
 * trigger would block them anyway, so this runs with the service client
 * after checking ownership from the session (never from the request body).
 * The update is conditional on status and driver_id so a driver accepting
 * at the same moment wins cleanly and the customer gets a 409.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(`client-cancel:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  const { id: deliveryId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  }

  const admin = createServiceClient();
  const { data: delivery } = await admin
    .from('deliveries')
    .select('id, customer_id, status, driver_id')
    .eq('id', deliveryId)
    .maybeSingle();

  const decision = evaluateCustomerCancel(user.id, delivery ?? null);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.httpStatus });
  }

  const { data: cancelled, error: cancelError } = await admin
    .from('deliveries')
    .update({ status: 'cancelled' })
    .eq('id', deliveryId)
    .eq('customer_id', user.id)
    .is('driver_id', null)
    .in('status', [...CUSTOMER_CANCELLABLE_STATUSES])
    .select('id');

  if (cancelError) {
    console.error('customer cancel failed', { deliveryId, error: cancelError.message });
    return NextResponse.json({ error: 'Could not cancel. Try again.' }, { status: 500 });
  }
  if (!cancelled || cancelled.length === 0) {
    // Lost a race with dispatch or a driver accept.
    return NextResponse.json({ error: ALREADY_ASSIGNED_MESSAGE }, { status: 409 });
  }

  const followUps = await Promise.all([
    admin
      .from('job_offers')
      .update({ status: 'expired' })
      .eq('delivery_id', deliveryId)
      .eq('status', 'pending'),
    admin.from('delivery_events').insert({
      delivery_id: deliveryId,
      event_type: 'customer_cancelled',
      old_status: delivery!.status,
      new_status: 'cancelled',
      notes: 'Cancelled by the customer',
      created_by: user.id,
    }),
  ]);
  const failed = followUps.map((r) => r.error?.message).filter(Boolean);
  if (failed.length > 0) {
    console.error('customer cancel follow-up failed', { deliveryId, failed });
  }

  return NextResponse.json({ ok: true });
}
