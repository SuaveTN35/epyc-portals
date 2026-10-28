import { NextRequest, NextResponse } from 'next/server';
import { generateTrackingNumber } from '@epyc/shared';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { RouteNotFoundError } from '@/lib/server/distance';
import { priceSourceNote, resolveBookingRoute, type ResolvedRoute } from '@/lib/server/booking-route';
import {
  buildCustomerBookingRow,
  parseBookingRequest,
  quoteForBooking,
  toCustomerQuote,
} from '@/lib/customer-booking';

/**
 * POST /api/client/deliveries  (P-358)
 *
 * The only way a customer creates a delivery. Price is never taken from the
 * request: the body carries the booking form and the two coordinates picked
 * from the address suggestions. Since P-362 those coordinates are a hint
 * only: the server geocodes the address TEXT for both ends
 * (lib/server/booking-route.ts), prices the distance between the server
 * points, and stores the server points. If an address cannot be geocoded,
 * nothing is priced. With { quote_only: true } it returns the quote and writes
 * nothing; the Quote step shows that number. Otherwise it inserts with the
 * service role (the insert guard refuses direct customer inserts since
 * 20261028000400) and returns id, tracking_number, and the quote that was
 * stored, which is the amount the payment intent will charge.
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`client-book:${getClientIdentifier(request)}`, RATE_LIMITS.quotes);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many requests. Wait a moment.' },
      { status: 429, headers: rateLimitHeaders(rate) }
    );
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid booking request' }, { status: 400 });
  }

  const parsed = parseBookingRequest(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, ...(parsed.details ? { details: parsed.details } : {}) },
      { status: parsed.httpStatus }
    );
  }
  const { body, pickup, dropoff } = parsed;

  let resolved: ResolvedRoute;
  try {
    resolved = await resolveBookingRoute(body, pickup, dropoff);
  } catch (err) {
    if (err instanceof RouteNotFoundError) {
      return NextResponse.json(
        { error: 'We could not find a driving route between these addresses.' },
        { status: 400 }
      );
    }
    console.error('booking distance failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not price this route. Try again.' }, { status: 502 });
  }
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.httpStatus });
  }
  const { priceSource } = resolved;
  // Which sources priced the job. No addresses or coordinates in the log.
  console.info('booking priced', {
    userId: user.id,
    quoteOnly: body.quote_only === true,
    ...priceSource,
  });

  const quote = quoteForBooking(body, resolved.route.distance_miles);
  const customerQuote = toCustomerQuote(quote);

  if (body.quote_only) {
    return NextResponse.json({ quote: customerQuote }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = createServiceClient();
  // One retry on a tracking number collision (unique violation 23505).
  for (let attempt = 0; attempt < 2; attempt++) {
    const trackingNumber = generateTrackingNumber();
    const { data, error } = await admin
      .from('deliveries')
      .insert(
        buildCustomerBookingRow({
          customerId: user.id,
          trackingNumber,
          form: body,
          quote,
          // Server geocodes, never the browser's coordinates.
          pickup: resolved.pickup,
          dropoff: resolved.dropoff,
        })
      )
      .select('id, tracking_number')
      .single();

    if (!error && data) {
      // Record the price source on the job's event trail. Best effort: the
      // booking stands even if this insert fails.
      const { error: eventError } = await admin.from('delivery_events').insert({
        delivery_id: data.id,
        event_type: 'priced',
        notes: priceSourceNote(priceSource),
      });
      if (eventError) {
        console.error('price source event insert failed', { deliveryId: data.id, error: eventError.message });
      }
      return NextResponse.json(
        { id: data.id, tracking_number: data.tracking_number, quote: customerQuote },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (error?.code !== '23505') {
      console.error('customer booking insert failed', { userId: user.id, error: error?.message });
      break;
    }
  }

  return NextResponse.json({ error: 'Could not create the delivery. Try again.' }, { status: 500 });
}
