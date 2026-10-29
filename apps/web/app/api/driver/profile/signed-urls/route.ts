import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { isOwnUploadPath } from '@/lib/driver-profile';
import { isSafeStoragePath } from '@/lib/server/document-paths';
import { PROFILE_ITEMS } from '@/lib/driver-profile-items';

/**
 * POST /api/driver/profile/signed-urls   body: { paths: string[] } (max 20)
 *
 * Short-lived signed URLs so a driver can see their own photos. A path is
 * signed only if it is in the caller's own folder (drivers/<user id>/...) or
 * is exactly a file already recorded on the caller's own drivers row or
 * review rows (older uploads live in shared folders). Every path must also
 * be a plain storage path (isSafeStoragePath: no ".", "..", "%", or empty
 * segments, which fetch would rewrite). Anything else is silently left out.
 */
const EXPIRY_SECONDS = 300;
const MAX_PATHS = 20;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`driver-signed-urls:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });

  let paths: unknown;
  try {
    ({ paths } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!Array.isArray(paths) || paths.length > MAX_PATHS || !paths.every((p) => typeof p === 'string')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });

  const admin = createServiceClient();
  const columns = PROFILE_ITEMS.flatMap((i) => ('column' in i ? [i.column] : []));
  const { data: driver } = await admin
    .from('drivers')
    .select(['id', ...columns].join(', '))
    .eq('profile_id', user.id)
    .maybeSingle();

  const onRecord = new Set<string>();
  if (driver) {
    const row = driver as unknown as Record<string, string | null>;
    for (const c of columns) if (row[c]) onRecord.add(row[c] as string);
    const { data: reviews } = await admin.from('driver_review_items').select('photo_path').eq('driver_id', row.id);
    for (const r of reviews || []) if (r.photo_path) onRecord.add(r.photo_path);
  }

  const allowed = (paths as string[]).filter(
    (p) => isSafeStoragePath(p) && (isOwnUploadPath(p, user.id) || onRecord.has(p))
  );
  if (allowed.length === 0) return NextResponse.json({ urls: {} });

  const { data, error } = await admin.storage.from('driver-documents').createSignedUrls(allowed, EXPIRY_SECONDS);
  if (error) {
    console.error('[driver-signed-urls] signing failed', { message: error.message });
    return NextResponse.json({ error: 'Could not load photos' }, { status: 500 });
  }
  const urls: Record<string, string> = {};
  for (const d of data || []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return NextResponse.json({ urls, expires_in: EXPIRY_SECONDS });
}
