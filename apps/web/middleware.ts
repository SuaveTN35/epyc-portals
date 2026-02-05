import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function middleware(request: NextRequest) {
  // Skip session auth for broker API routes (uses API key auth)
  if (request.nextUrl.pathname.startsWith('/api/broker')) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Client portal protected routes
  const clientProtectedPaths = ['/client/deliveries', '/client/quotes', '/client/payments', '/client/settings', '/client/support'];
  const isClientProtected = clientProtectedPaths.some((path) => pathname.startsWith(path));

  if (isClientProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/client/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Driver portal protected routes
  const driverProtectedPaths = ['/driver/jobs', '/driver/active', '/driver/earnings', '/driver/profile', '/driver/delivery'];
  const isDriverProtected = driverProtectedPaths.some((path) => pathname.startsWith(path));

  if (isDriverProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/driver/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Check driver role for driver portal
  if (isDriverProtected && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'driver') {
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, background_check_status')
        .eq('profile_id', user.id)
        .single();

      if (!driver) {
        const url = request.nextUrl.clone();
        url.pathname = '/driver/onboarding';
        return NextResponse.redirect(url);
      }
    }
  }

  // Dispatch portal protected routes
  const dispatchProtectedPaths = ['/dispatch'];
  const isDispatchProtected = dispatchProtectedPaths.some((path) => pathname.startsWith(path)) && pathname !== '/dispatch/login';

  if (isDispatchProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dispatch/login';
    return NextResponse.redirect(url);
  }

  // Check dispatcher/admin role for dispatch portal
  if (isDispatchProtected && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['dispatcher', 'admin'].includes(profile.role)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dispatch/unauthorized';
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from login pages
  const loginPaths = ['/client/login', '/client/register', '/driver/login', '/dispatch/login'];
  const isLoginPath = loginPaths.some((path) => pathname === path);

  if (isLoginPath && user) {
    const url = request.nextUrl.clone();
    if (pathname.startsWith('/client')) {
      url.pathname = '/client/deliveries';
    } else if (pathname.startsWith('/driver')) {
      url.pathname = '/driver/jobs';
    } else if (pathname.startsWith('/dispatch')) {
      url.pathname = '/dispatch';
    }
    return NextResponse.redirect(url);
  }

  // For driver registration, check if user is already a driver
  // Allow non-drivers to see the registration page even if logged in
  if (pathname === '/driver/register' && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Only redirect if already a driver
    if (profile?.role === 'driver') {
      const url = request.nextUrl.clone();
      url.pathname = '/driver/jobs';
      return NextResponse.redirect(url);
    }
    // Otherwise, let them see the registration page (client wanting to also be a driver)
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
