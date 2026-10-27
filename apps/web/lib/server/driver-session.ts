// Server-only helpers for driver API routes. The service-role client bypasses
// RLS, so it is created per request and only after the caller is identified
// from their own session cookie. Never import this from a client component.

import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';

export function createServiceClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export interface CallerDriverSession {
  userId: string;
  driver: { id: string; status: string | null; current_delivery_id: string | null } | null;
  admin: SupabaseClient;
}

/**
 * Returns the signed-in user and their drivers row, or null when there is no
 * session. The drivers row is read with the service client so the answer does
 * not depend on RLS; the lookup key is the session user id, never a value
 * from the request.
 */
export async function getCallerDriver(): Promise<CallerDriverSession | null> {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;

  const admin = createServiceClient();
  const { data: driver } = await admin
    .from('drivers')
    .select('id, status, current_delivery_id')
    .eq('profile_id', user.id)
    .maybeSingle();

  return { userId: user.id, driver: driver ?? null, admin };
}
