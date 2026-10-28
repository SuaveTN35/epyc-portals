import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getProfileItem, isProfileItemId } from '@/lib/driver-profile-items';
import { buildUploadPath, HEIC_MESSAGE } from '@/lib/driver-profile';

/**
 * POST /api/driver/profile/upload   multipart: file, item, record ('1' or absent)
 *
 * Signed-in drivers and applicants only. Stores the photo in the private
 * driver-documents bucket under the caller's own folder,
 * drivers/<session user id>/<item>-<time>-<rand>.<ext>; the folder comes from
 * the session, never from the request.
 *
 * record=1 (profile retake): also records it, using the caller's OWN session
 * client so the database guards apply as the driver:
 *   * vehicle / document items -> drivers.<column> = path; the
 *     queue_driver_profile_reviews trigger sets the review row to pending;
 *   * gear items -> upsert driver_review_items with owned = true (a photo
 *     also declares the gear; forced to pending by guard_driver_review_item);
 *   * id_badge_photo -> same, and only once dispatch has approved the driver
 *     (TRIBUNAL R1; the database enforces it too).
 * HEIC/HEIF is refused with a clear message: the browser converts photos to
 * JPEG before upload, so a HEIC arriving here is one the phone's browser
 * could not open, and dispatch's browser would not be able to show it (QA N4).
 * Without record (onboarding, before the drivers row exists) only the path is
 * returned and the onboarding submit records it.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};


export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`driver-profile-upload:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many uploads. Wait a minute and try again.' }, { status: 429 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }
  const file = form.get('file');
  const item = form.get('item');
  const record = form.get('record') === '1';

  if (!isProfileItemId(item)) return NextResponse.json({ error: 'Unknown item' }, { status: 400 });
  const def = getProfileItem(item)!;
  if (def.kind !== 'photo') return NextResponse.json({ error: 'This item does not take a photo' }, { status: 400 });
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Choose a photo first' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 400 });

  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') {
    return NextResponse.json({ error: HEIC_MESSAGE }, { status: 400 });
  }
  const ext = IMAGE_TYPES[type] ?? (def.allowPdf && type === 'application/pdf' ? 'pdf' : null);
  if (!ext) {
    return NextResponse.json(
      { error: def.allowPdf ? 'Please send a photo or a PDF.' : 'Please send a photo (JPG, PNG, or iPhone photo).' },
      { status: 400 }
    );
  }

  const session0 = record ? await session.from('drivers').select('id, status').eq('profile_id', user.id).maybeSingle() : null;
  if (item === 'id_badge_photo' && (!record || session0?.data?.status !== 'active')) {
    return NextResponse.json({ error: 'You can add your ID badge photo after your application is approved' }, { status: 403 });
  }

  const path = buildUploadPath(user.id, item, ext);
  const admin = createServiceClient();
  const { error: uploadError } = await admin.storage
    .from('driver-documents')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, upsert: false });
  if (uploadError) {
    console.error('[driver-profile-upload] storage error', { item, message: uploadError.message });
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  if (!record) return NextResponse.json({ path });

  const driver = session0?.data ?? null;
  if (!driver) return NextResponse.json({ error: 'Finish your driver application first' }, { status: 409 });

  const { error: saveError } = def.column
    ? await session.from('drivers').update({ [def.column]: path }).eq('id', driver.id)
    : await session
        .from('driver_review_items')
        .upsert(
          { driver_id: driver.id, item, photo_path: path, ...(def.group === 'equipment' ? { owned: true } : {}) },
          { onConflict: 'driver_id,item' }
        );

  if (saveError) {
    console.error('[driver-profile-upload] save error', { item, code: saveError.code });
    return NextResponse.json({ error: 'Saved the photo but could not record it. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ path, status: 'pending' });
}
