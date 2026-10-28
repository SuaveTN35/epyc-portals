// Server-only: is this driver allowed new work right now? (P-366)
// Same rule as driver_offer_block_reason() in the database, which also
// enforces it on job_offers and deliveries; this gives a clear message first.
import type { SupabaseClient } from '@supabase/supabase-js';
import { newWorkBlockReason, pacificToday, type DriverProfileFields, type ReviewRow } from '@/lib/driver-profile';
import { READINESS_DRIVER_COLUMNS } from '@/lib/driver-readiness';

export async function loadOfferBlockReason(admin: SupabaseClient, driverId: string): Promise<string | null> {
  const [{ data: driver }, { data: rows }] = await Promise.all([
    admin.from('drivers').select(READINESS_DRIVER_COLUMNS).eq('id', driverId).maybeSingle(),
    admin
      .from('driver_review_items')
      .select('item, photo_path, status, reason, owned')
      .eq('driver_id', driverId),
  ]);
  if (!driver) return 'Driver not found';
  return newWorkBlockReason(driver as unknown as DriverProfileFields, (rows as ReviewRow[]) || [], pacificToday());
}

/** Message shown to a driver whose accept is refused by the new-work rule. */
export function blockedAcceptMessage(reason: string): string {
  return `You can't take new jobs right now: ${reason}. Fix it on your Profile; dispatch reviews what you upload.`;
}
