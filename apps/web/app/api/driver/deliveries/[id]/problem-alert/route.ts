import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getCallerDriver } from '@/lib/server/driver-session';
import { recentlyTexted, sendSms } from '@/lib/server/sms';
import { EXCEPTION_REASONS } from '@/lib/driver-job';
import { isUuid, problemOpsText } from '@/lib/sms';

/**
 * POST /api/driver/deliveries/:id/problem-alert   body: { reason }
 *
 * Called by the Report a problem sheet after the exception event is saved.
 * Texts the ops number in EPYC_OPS_SMS (no-op when unset). The caller must be
 * the assigned driver and must have logged an exception on this job in the
 * last 10 minutes. The driver's free-text note is never sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(`problem-alert:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  const { id: deliveryId } = await params;
  if (!isUuid(deliveryId)) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const reason = (body as { reason?: unknown } | null)?.reason;
  const match = EXCEPTION_REASONS.find((r) => r.value === reason);
  if (!match) return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });

  const caller = await getCallerDriver();
  if (!caller) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  const { admin, driver, userId } = caller;
  if (!driver) return NextResponse.json({ error: 'No driver account' }, { status: 403 });

  const { data: delivery } = await admin
    .from('deliveries')
    .select('id, driver_id, tracking_number')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!delivery || delivery.driver_id !== driver.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const opsNumber = process.env.EPYC_OPS_SMS;
  if (!opsNumber || !opsNumber.trim()) return NextResponse.json({ result: 'skipped_no_ops_number' });

  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin
    .from('delivery_events')
    .select('id', { count: 'exact', head: true })
    .eq('delivery_id', deliveryId)
    .eq('event_type', 'exception')
    .eq('created_by', userId)
    .gte('created_at', since);
  if (!count) return NextResponse.json({ error: 'No problem report found' }, { status: 409 });

  if (await recentlyTexted(admin, { kind: 'problem_ops', deliveryId, withinMinutes: 2 })) {
    return NextResponse.json({ result: 'skipped_duplicate' });
  }

  const result = await sendSms({
    admin,
    to: opsNumber,
    body: problemOpsText({ reasonLabel: match.label, deliveryId, jobRef: delivery.tracking_number }),
    kind: 'problem_ops',
    profileId: null,
    deliveryId,
  });
  return NextResponse.json({ result });
}
