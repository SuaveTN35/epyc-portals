// Server-only: is this driver allowed new work right now? (P-366)
// Same rule as driver_offer_block_reason() in the database, which also
// enforces it on job_offers and deliveries; this gives a clear message first.
import type { SupabaseClient } from '@supabase/supabase-js';
import { offerBlockReason, pacificToday } from '@/lib/driver-profile';

export async function loadOfferBlockReason(admin: SupabaseClient, driverId: string): Promise<string | null> {
  const [{ data: driver }, { data: review }] = await Promise.all([
    admin.from('drivers').select('insurance_card_url, insurance_expiry').eq('id', driverId).maybeSingle(),
    admin
      .from('driver_review_items')
      .select('status, photo_path')
      .eq('driver_id', driverId)
      .eq('item', 'insurance_card')
      .maybeSingle(),
  ]);
  if (!driver) return 'Driver not found';
  return offerBlockReason(driver, review ?? null, pacificToday());
}

/** Message shown to a driver whose accept is refused for insurance. */
export function blockedAcceptMessage(reason: string): string {
  return `You can't take new jobs right now: ${reason}. Update your insurance on your Profile; dispatch must approve it.`;
}
