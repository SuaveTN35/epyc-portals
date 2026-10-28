import { NextRequest, NextResponse } from 'next/server';
import { generateTrackingNumber } from '@epyc/shared';
import { checkRateLimit, getClientIdentifier, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { computeRouteDistance, RouteNotFoundError } from '@/lib/server/distance';
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
 * from the address suggestions, and the server recomputes the distance and
 * the quote. With { quote_only: true } it returns the quote and writes
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

  let distanceMiles: number;
  try {
    distanceMiles = (await computeRouteDistance(pickup, dropoff)).distance_miles;
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

  const quote = quoteForBooking(body, distanceMiles);
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
          pickup,
          dropoff,
        })
      )
      .select('id, tracking_number')
      .single();

    if (!error && data) {
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
