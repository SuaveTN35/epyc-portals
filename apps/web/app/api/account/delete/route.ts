import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { DELETE_CONFIRM_WORD, deleteOwnAccount } from '@/lib/server/account-deletion';

/**
 * POST /api/account/delete   { confirm: "DELETE" }
 *
 * Deletes the signed-in customer's or driver's own account (App Store and
 * Google Play account deletion rule). The account is always the session
 * user; nothing in the body picks it. See lib/server/account-deletion.ts.
 */
export async function POST(request: NextRequest) {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again to delete your account.' }, { status: 401 });

  const rate = checkRateLimit(`account-delete:${user.id}`, { limit: 5, windowSeconds: 600 });
  if (!rate.success) return NextResponse.json({ error: 'Too many tries. Wait a few minutes.' }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const confirm = (body as { confirm?: unknown } | null)?.confirm;
  if (typeof confirm !== 'string' || confirm.trim().toUpperCase() !== DELETE_CONFIRM_WORD) {
    return NextResponse.json({ error: `Type ${DELETE_CONFIRM_WORD} to confirm.` }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Account deletion is not set up on this site yet. Email admin@epyccs.com to delete your account.' },
      { status: 503 }
    );
  }

  const result = await deleteOwnAccount(createServiceClient(), user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // The auth user is gone or banned; clear this browser's session too.
  await session.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true, mode: result.mode });
}
