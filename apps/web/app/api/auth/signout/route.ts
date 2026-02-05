import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  // Redirect to home page after sign out
  return NextResponse.redirect(new URL('/', request.url));
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  // Redirect to home page after sign out
  return NextResponse.redirect(new URL('/', request.url));
}
