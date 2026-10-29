// Dispatch alert loader (P-366, Commander ruling 2026-10-28): which drivers on
// active jobs have lapsed insurance. Read only; nothing is reassigned. Takes
// any Supabase client (dispatch browser client under staff RLS).
import type { SupabaseClient } from '@supabase/supabase-js';
import { ACTIVE_DELIVERY_STATUSES } from './delivery-status';
import { insuranceLapsed, pacificToday, type ReviewRow } from './driver-profile';

/** True for a job a driver is on and has not finished (assigned through arrived at drop-off). */
export function isActiveJobStatus(status: string | null | undefined): boolean {
  return !!status && (ACTIVE_DELIVERY_STATUSES as string[]).includes(status);
}

/** Ids of the given drivers whose insurance is lapsed today. */
export async function loadLapsedInsuranceDrivers(supabase: SupabaseClient, driverIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(driverIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const [{ data: drivers }, { data: rows }] = await Promise.all([
    supabase.from('drivers').select('id, insurance_card_url, insurance_expiry').in('id', ids),
    supabase
      .from('driver_review_items')
      .select('driver_id, item, photo_path, status, reason')
      .eq('item', 'insurance_card')
      .in('driver_id', ids),
  ]);
  const review = new Map<string, ReviewRow>();
  for (const r of (rows || []) as Array<ReviewRow & { driver_id: string }>) review.set(r.driver_id, r);
  const today = pacificToday();
  const out = new Set<string>();
  for (const d of (drivers || []) as Array<{ id: string; insurance_card_url: string | null; insurance_expiry: string | null }>) {
    if (insuranceLapsed(d, review.get(d.id) ?? null, today)) out.add(d.id);
  }
  return out;
}

/** Driver ids on active jobs, for loadLapsedInsuranceDrivers. */
export function activeJobDriverIds(jobs: Array<{ status: string | null | undefined; driver_id: string | null | undefined }>): string[] {
  return jobs.filter((j) => isActiveJobStatus(j.status) && !!j.driver_id).map((j) => j.driver_id as string);
}
