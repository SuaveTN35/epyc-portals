import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitHeaders, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { distanceRequestSchema, validateRequest } from '@/lib/validations';
import { computeRouteDistance, RouteNotFoundError } from '@/lib/server/distance';

// Informational distance lookup. Booking does NOT trust this response: the
// booking route recomputes distance on the server (lib/server/distance.ts).
export async function POST(request: NextRequest) {
  // Rate limit by IP
  const clientId = getClientIdentifier(request);
  const rateLimitResult = checkRateLimit(`distance:${clientId}`, RATE_LIMITS.api);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const rawBody = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(distanceRequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      );
    }

    const body = validation.data;
    const result = await computeRouteDistance(body.origin, body.destination);
    const { source, ...rest } = result;
    // Keep the old response shape: Google results carried no source field.
    return NextResponse.json(source === 'google' ? rest : result);
  } catch (error) {
    if (error instanceof RouteNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Distance calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate distance' },
      { status: 500 }
    );
  }
}
