import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import {
  pacificToday,
  validateDimensions,
  validateInsuranceDetails,
  validateRegistrationExpiry,
} from '@/lib/driver-profile';

/**
 * POST /api/driver/profile/details   body: { section, ...fields }
 *   section 'insurance'    carrier, policy, expiry, limits, business use
 *   section 'registration' registration_expiry
 *   section 'dimensions'   cargo length/width/height (in) and capacity (lbs)
 *
 * Validates, then updates the caller's own drivers row with the caller's
 * session client, so RLS and the database triggers apply as the driver: any
 * change sends that group back to 'pending' for dispatch review. Changing
 * insurance therefore pauses new job offers until dispatch approves.
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`driver-profile-details:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object') throw new Error('bad');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const today = pacificToday();
  let patch: Record<string, unknown>;
  switch (body.section) {
    case 'insurance': {
      const v = validateInsuranceDetails(body, today);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      patch = { ...v.value };
      break;
    }
    case 'registration': {
      const v = validateRegistrationExpiry(body, today);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      patch = { ...v.value };
      break;
    }
    case 'dimensions': {
      const v = validateDimensions(body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      patch = { ...v.value };
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });

  const { data, error } = await session
    .from('drivers')
    .update(patch)
    .eq('profile_id', user.id)
    .select('id');
  if (error) {
    console.error('[driver-profile-details] update error', { section: body.section, code: error.code });
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Finish your driver application first' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, status: 'pending' });
}
