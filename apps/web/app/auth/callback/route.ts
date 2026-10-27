import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Email verification landing point.
 *
 * Without this, Supabase sent verified users to the site root and a driver who
 * confirmed their email had no path back into stage-2 onboarding. Every applicant
 * stalled here.
 *
 * Exchanges the code for a session, then routes by what the account still needs.
 */
const RESET_PASSWORD_PATH = '/auth/reset-password';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  // Password reset links carry next=/auth/reset-password. That one exact path
  // is honoured for every role; any other `next` keeps the rules below.
  const isPasswordReset = next === RESET_PASSWORD_PATH;

  if (!code) {
    if (isPasswordReset) {
      return NextResponse.redirect(`${origin}/auth/forgot-password?error=expired`);
    }
    return NextResponse.redirect(`${origin}/driver/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] code exchange failed:', error.message);
    if (isPasswordReset) {
      return NextResponse.redirect(`${origin}/auth/forgot-password?error=expired`);
    }
    return NextResponse.redirect(`${origin}/driver/login?error=verification_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/driver/login`);
  }

  if (isPasswordReset) {
    return NextResponse.redirect(`${origin}${RESET_PASSWORD_PATH}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'driver') {
    // Onboarding is only complete once a drivers row exists.
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();

    return NextResponse.redirect(
      `${origin}${driver ? '/driver/jobs' : '/driver/onboarding'}`
    );
  }

  if (profile?.role === 'dispatcher' || profile?.role === 'admin') {
    return NextResponse.redirect(`${origin}/dispatch`);
  }

  // Only honour an internal relative path.
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/client/deliveries`);
}
