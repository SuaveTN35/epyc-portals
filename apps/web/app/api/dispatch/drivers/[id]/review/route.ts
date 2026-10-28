import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getCallerStaff } from '@/lib/server/staff-session';
import { getProfileItem } from '@/lib/driver-profile-items';
import { dimensionsComplete, parseReviewDecision } from '@/lib/driver-profile';

/**
 * POST /api/dispatch/drivers/:id/review
 *   body: { item, decision: 'approve' | 'reject', reason?, photo_path? }
 *
 * Staff only (admin / dispatcher). Approves or rejects one checklist item.
 * The file approved is always the one currently on record (drivers column for
 * vehicle/document items, the review row for equipment). If the browser sent
 * the photo_path it was showing and the driver has since uploaded a new one,
 * the route answers 409 so dispatch never approves a photo it did not see.
 * Approving the insurance card is what lets an insured driver get new offers.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(`dispatch-review:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = parseReviewDecision(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { item, decision, reason, photo_path: seenPath } = parsed.value;

  const caller = await getCallerStaff();
  if (!caller) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  const { admin, userId } = caller;
  const { id: driverId } = await params;

  const { data: driver } = await admin
    .from('drivers')
    .select(
      'id, insurance_card_url, registration_url, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_side_url, vehicle_photo_cargo_url, cargo_length_in, cargo_width_in, cargo_height_in, cargo_capacity_lbs'
    )
    .eq('id', driverId)
    .maybeSingle();
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

  const def = getProfileItem(item)!;
  const { data: existing } = await admin
    .from('driver_review_items')
    .select('photo_path')
    .eq('driver_id', driverId)
    .eq('item', item)
    .maybeSingle();

  let currentPath: string | null;
  if (def.kind === 'data') {
    if (!dimensionsComplete(driver)) {
      return NextResponse.json({ error: 'The driver has not entered all dimensions yet' }, { status: 409 });
    }
    currentPath = null;
  } else {
    currentPath = def.column
      ? ((driver as Record<string, unknown>)[def.column] as string | null)
      : (existing?.photo_path ?? null);
    if (!currentPath) return NextResponse.json({ error: 'Nothing uploaded for this item yet' }, { status: 409 });
    if (seenPath && seenPath !== currentPath) {
      return NextResponse.json({ error: 'The driver uploaded a new photo. Reload and review it.' }, { status: 409 });
    }
  }

  const { data: saved, error } = await admin
    .from('driver_review_items')
    .upsert(
      {
        driver_id: driverId,
        item,
        photo_path: currentPath,
        status: decision === 'approve' ? 'approved' : 'rejected',
        reason: decision === 'approve' ? null : reason,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id,item' }
    )
    .select('item, status, reason, photo_path, reviewed_at')
    .single();

  if (error) {
    console.error('[dispatch-review] save failed', { item, code: error.code });
    return NextResponse.json({ error: 'Could not save the review' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, review: saved });
}
