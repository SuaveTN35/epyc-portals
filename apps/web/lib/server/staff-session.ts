// Server-only: identify a signed-in dispatcher or admin from their session cookie.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';

export interface CallerStaffSession {
  userId: string;
  admin: SupabaseClient;
}

/** The caller if they are staff (role admin or dispatcher), else null. */
export async function getCallerStaff(): Promise<CallerStaffSession | null> {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;

  const admin = createServiceClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['admin', 'dispatcher'].includes(profile.role)) return null;
  return { userId: user.id, admin };
}
