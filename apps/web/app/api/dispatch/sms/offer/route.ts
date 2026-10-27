import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getCallerStaff } from '@/lib/server/staff-session';
import { sendDriverSms, type SmsResult } from '@/lib/server/sms';
import { offerText, parseOfferSmsRequest } from '@/lib/sms';

/**
 * POST /api/dispatch/sms/offer   body: { delivery_id, driver_ids }
 *
 * Staff only. Called by OfferJobDialog after it inserts job_offers rows. Texts
 * each offered driver who opted in to SMS. Only drivers with a pending offer
 * on this job created in the last 10 minutes are texted, so the route cannot
 * be used to text arbitrary drivers. Never fails the offer: SMS problems are
 * reported in the response body with status 200.
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`sms-offer:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = parseOfferSmsRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const caller = await getCallerStaff();
  if (!caller) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  const { admin } = caller;

  const { data: delivery } = await admin
    .from('deliveries')
    .select('id, pickup_city, delivery_city, driver_payout')
    .eq('id', parsed.deliveryId)
    .maybeSingle();
  if (!delivery) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: offers } = await admin
    .from('job_offers')
    .select('driver_id, estimated_payout, drivers(profile_id)')
    .eq('delivery_id', parsed.deliveryId)
    .eq('status', 'pending')
    .in('driver_id', parsed.driverIds)
    .gte('created_at', since);

  const results: Record<string, SmsResult> = {};
  for (const offer of offers || []) {
    const drv = (Array.isArray(offer.drivers) ? offer.drivers[0] : offer.drivers) as { profile_id?: string } | null;
    if (!drv?.profile_id) continue;
    results[offer.driver_id as string] = await sendDriverSms({
      admin,
      profileId: drv.profile_id,
      kind: 'job_offer',
      deliveryId: parsed.deliveryId,
      body: offerText({
        pickupCity: delivery.pickup_city,
        dropoffCity: delivery.delivery_city,
        payout: offer.estimated_payout ?? delivery.driver_payout,
      }),
    });
  }

  const sent = Object.values(results).filter((r) => r === 'sent').length;
  return NextResponse.json({ sent, results });
}
