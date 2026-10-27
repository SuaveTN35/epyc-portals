import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getCallerStaff } from '@/lib/server/staff-session';
import { sendDriverSms } from '@/lib/server/sms';
import { assignedText, parseAssignedSmsRequest } from '@/lib/sms';

/**
 * POST /api/dispatch/sms/assigned   body: { delivery_id }
 *
 * Staff only. Called after dispatch assigns a job directly. Texts the driver
 * now on the job (read from the database, not the request) if they opted in.
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`sms-assigned:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = parseAssignedSmsRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const caller = await getCallerStaff();
  if (!caller) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  const { admin } = caller;

  const { data: delivery } = await admin
    .from('deliveries')
    .select('id, status, driver_id, drivers!driver_id(profile_id)')
    .eq('id', parsed.deliveryId)
    .maybeSingle();
  if (!delivery || !delivery.driver_id) return NextResponse.json({ error: 'Job has no driver' }, { status: 404 });

  const drv = (Array.isArray(delivery.drivers) ? delivery.drivers[0] : delivery.drivers) as { profile_id?: string } | null;
  if (!drv?.profile_id) return NextResponse.json({ result: 'skipped_no_phone' });

  const result = await sendDriverSms({
    admin,
    profileId: drv.profile_id,
    kind: 'job_assigned',
    deliveryId: parsed.deliveryId,
    body: assignedText(parsed.deliveryId),
  });
  return NextResponse.json({ result });
}
