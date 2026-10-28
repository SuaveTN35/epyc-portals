// Dispatch-side loader: insurance block, badges, and declared gear for a
// set of drivers (P-366). Takes any Supabase client (dispatch browser client
// under staff RLS). The database enforces the insurance block regardless;
// this is what lets the offer and assign pickers explain and skip.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  declaredGear,
  dispatchBadges,
  gearMatch,
  type DeclaredGear,
  type GearMatch,
  offerBlockReason,
  pacificToday,
  type DispatchBadge,
  type DriverProfileFields,
  type ReviewRow,
} from './driver-profile';

export const READINESS_DRIVER_COLUMNS =
  'id, insurance_card_url, insurance_expiry, insurance_policy, insurance_carrier, insurance_bi_per_person, insurance_bi_per_accident, insurance_pd_limit, insurance_business_use, registration_url, registration_expiry, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_side_url, vehicle_photo_cargo_url, cargo_length_in, cargo_width_in, cargo_height_in, cargo_capacity_lbs';

export interface DriverReadiness {
  blockReason: string | null;
  badges: DispatchBadge[];
  /** Gear the driver lists as owned, and whether its photo is approved. */
  gear: DeclaredGear[];
  /** Informational match against a job's gear list (empty when none given). */
  match: GearMatch;
}

export function readinessFor(
  driver: DriverProfileFields,
  rows: ReviewRow[],
  today: string,
  neededGear: readonly string[] = []
): DriverReadiness {
  const insurance = rows.find((r) => r.item === 'insurance_card') ?? null;
  return {
    blockReason: offerBlockReason(driver, insurance, today),
    badges: dispatchBadges(driver, rows, today),
    gear: declaredGear(rows),
    match: gearMatch(rows, neededGear),
  };
}

export async function loadDriverReadiness(
  supabase: SupabaseClient,
  driverIds: string[],
  neededGear: readonly string[] = []
): Promise<Record<string, DriverReadiness>> {
  if (driverIds.length === 0) return {};
  const [{ data: drivers }, { data: rows }] = await Promise.all([
    supabase.from('drivers').select(READINESS_DRIVER_COLUMNS).in('id', driverIds),
    supabase.from('driver_review_items').select('driver_id, item, photo_path, status, reason, owned').in('driver_id', driverIds),
  ]);
  const byDriver: Record<string, ReviewRow[]> = {};
  for (const r of (rows || []) as Array<ReviewRow & { driver_id: string }>) {
    (byDriver[r.driver_id] ||= []).push(r);
  }
  const today = pacificToday();
  const out: Record<string, DriverReadiness> = {};
  for (const d of (drivers || []) as unknown as Array<DriverProfileFields & { id: string }>) {
    out[d.id] = readinessFor(d, byDriver[d.id] || [], today, neededGear);
  }
  return out;
}
