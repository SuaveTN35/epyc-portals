import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { notifyClient } from '@/lib/server/client-alerts';
import { isUuid } from '@/lib/sms';

/**
 * POST /api/deliveries/:id/client-alert   (no body)
 *
 * Asks the server to send the client whatever alert the job's current status
 * calls for (driver assigned, picked up, delivered). Called fire-and-forget by
 * the driver app after pickup and drop-off, and by dispatch after assigning.
 *
 * The caller must be the job's assigned driver, or staff (admin or
 * dispatcher). The alert is chosen from the database status, and each alert
 * goes out once per job and channel, so calling this again is harmless.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(`client-alert:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  const { id: deliveryId } = await params;
  if (!isUuid(deliveryId)) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Alerts are not set up' }, { status: 503 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });

  const admin = createServiceClient();
  const [{ data: delivery }, { data: profile }, { data: driver }] = await Promise.all([
    admin.from('deliveries').select('id, driver_id').eq('id', deliveryId).maybeSingle(),
    admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    admin.from('drivers').select('id').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!delivery) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const isStaff = !!profile && ['admin', 'dispatcher'].includes(profile.role);
  const isAssignedDriver = !!driver && delivery.driver_id === driver.id;
  // Someone else's job reads as "not found" so ids cannot be probed.
  if (!isStaff && !isAssignedDriver) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const result = await notifyClient(admin, deliveryId);
  return NextResponse.json({ result });
}
