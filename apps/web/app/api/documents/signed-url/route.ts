import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Issues a short-lived signed URL for a file in the private driver-documents
 * bucket. Driver licences and insurance documents are never publicly readable;
 * only staff can mint a link, and only for a path inside a known folder.
 */

const ALLOWED_PREFIXES = [
  'profile-photos/',
  'license-front/',
  'license-back/',
  'licenses/',
  'insurance/',
  'registration/',
  'vehicles/',
  // P-366: driver-owned folder drivers/<profile_id>/...
  'drivers/',
];

const MAX_BATCH = 30;

function isAllowedPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    !path.includes('..') &&
    ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

const EXPIRY_SECONDS = 300;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(
    `signed-url:${getClientIdentifier(request)}`,
    RATE_LIMITS.api
  );
  if (!rate.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'dispatcher'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let path: unknown;
  let paths: unknown;
  try {
    ({ path, paths } = await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // Batch form (P-366 review panel): { paths: string[] } -> { urls: { path: url } }.
  // Paths outside the allowed folders are left out of the answer.
  if (paths !== undefined) {
    if (!Array.isArray(paths) || paths.length > MAX_BATCH) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const allowed = paths.filter(isAllowedPath);
    if (allowed.length === 0) return NextResponse.json({ urls: {}, expires_in: EXPIRY_SECONDS });
    const batchAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await batchAdmin.storage
      .from('driver-documents')
      .createSignedUrls(allowed, EXPIRY_SECONDS);
    if (error) {
      console.error('[documents/signed-url] batch failed:', error.message);
      return NextResponse.json({ error: 'signing_failed' }, { status: 500 });
    }
    const urls: Record<string, string> = {};
    for (const d of data || []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
    return NextResponse.json({ urls, expires_in: EXPIRY_SECONDS });
  }

  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin.storage
    .from('driver-documents')
    .createSignedUrl(path, EXPIRY_SECONDS);

  if (error || !data) {
    console.error('[documents/signed-url] failed:', error?.message);
    return NextResponse.json({ error: 'signing_failed' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, expires_in: EXPIRY_SECONDS });
}
