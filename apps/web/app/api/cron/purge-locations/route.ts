import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { retentionCutoff } from '@/lib/live-location';

/**
 * GET /api/cron/purge-locations
 *
 * Daily Vercel cron (apps/web/vercel.json). Deletes driver_locations rows older
 * than 90 days. Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything
 * else is refused, and without CRON_SECRET set the route does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Not set up' }, { status: 503 });
  }
  const { error, count } = await createServiceClient()
    .from('driver_locations')
    .delete({ count: 'exact' })
    .lt('recorded_at', retentionCutoff(Date.now()));
  if (error) {
    console.error('[purge-locations]', error.message);
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
