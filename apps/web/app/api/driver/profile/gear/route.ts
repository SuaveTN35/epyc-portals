import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { isGearId } from '@/lib/driver-profile-items';

/**
 * POST /api/driver/profile/gear   body: { item, owned: boolean }
 *
 * The driver says whether they own a piece of gear (TRIBUNAL P-367 R12:
 * gear is declared, never required; a photo is optional). Written with the
 * caller's own session client, so RLS and guard_driver_review_item apply:
 * the row is the caller's, and it lands as 'pending'. An existing photo is
 * kept; owned = false hides the item from matching.
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`driver-profile-gear:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });

  let body: { item?: unknown; owned?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!isGearId(body?.item) || typeof body.owned !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });

  const { data: driver } = await session.from('drivers').select('id').eq('profile_id', user.id).maybeSingle();
  if (!driver) return NextResponse.json({ error: 'Finish your driver application first' }, { status: 409 });

  const { error } = await session
    .from('driver_review_items')
    .upsert({ driver_id: driver.id, item: body.item, owned: body.owned }, { onConflict: 'driver_id,item' });
  if (error) {
    console.error('[driver-profile-gear] save failed', { code: error.code });
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
