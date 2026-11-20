import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { isLiveTrackingStatus, isLocationFresh } from '@/lib/live-location';
import { isUuid } from '@/lib/sms';

/**
 * GET /api/client/deliveries/:id/live
 *
 * For the customer who booked the job: its current status and, while a driver
 * is on it (assigned through arrived at drop-off), the driver's latest
 * position if it is less than 15 minutes old. Customers cannot read
 * driver_locations through RLS, so this reads with the service client after
 * checking that the signed-in user owns the job. Anyone else gets 404.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(`client-live:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Live tracking is not set up' }, { status: 503 });
  }
  const admin = createServiceClient();

  const { data: job } = await admin
    .from('deliveries')
    .select('id, customer_id, status, driver_id, updated_at, pickup_lat, pickup_lng, delivery_lat, delivery_lng')
    .eq('id', id)
    .maybeSingle();
  if (!job || job.customer_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let driver: { lat: number; lng: number; recordedAt: string } | null = null;
  if (job.driver_id && isLiveTrackingStatus(job.status)) {
    const { data: rows } = await admin
      .from('driver_locations')
      .select('lat, lng, recorded_at, delivery_id')
      .eq('driver_id', job.driver_id)
      .order('recorded_at', { ascending: false })
      .limit(1);
    const row = rows?.[0];
    // Only a fix sent for this job (or with no job), so another customer's
    // route is never shown here.
    if (row && (row.delivery_id === null || row.delivery_id === job.id) && isLocationFresh(row.recorded_at, Date.now())) {
      driver = { lat: Number(row.lat), lng: Number(row.lng), recordedAt: row.recorded_at as string };
    }
  }

  const point = (lat: unknown, lng: unknown) =>
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : null;

  return NextResponse.json(
    {
      status: job.status,
      updatedAt: job.updated_at,
      driver,
      pickup: point(job.pickup_lat, job.pickup_lng),
      dropoff: point(job.delivery_lat, job.delivery_lng),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
