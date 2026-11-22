// Server-only: deletes a customer's or driver's own account. Required by the
// Apple App Store (guideline 5.1.1(v)) and Google Play (account deletion
// policy) for any app that lets people create an account.
//
// Two paths:
// 1. No delivery history: the Supabase auth user is deleted, and the profile,
//    drivers row and everything that cascades from them go with it.
// 2. Delivery history: deliveries, payments and invoices must stay for tax and
//    legal records, and their foreign keys stop a hard delete. So the person's
//    details are wiped instead: name, email, phone, company, vehicle and
//    license details, document files, location history and push devices. The
//    sign-in is renamed to a dead address and banned so it can never be used
//    again. The delivery rows keep only the id they point at.
//
// Staff (admin, dispatcher) cannot delete themselves here; an admin removes
// staff accounts. Nobody can delete an account while a job is in progress.

import type { SupabaseClient } from '@supabase/supabase-js';
import { isSafeStoragePath } from '@/lib/server/document-paths';

export { DELETE_CONFIRM_WORD } from '@/lib/account-deletion-copy';

/** Statuses where a job is open and someone is counting on it. */
export const OPEN_JOB_STATUSES = [
  'assigned',
  'en_route_pickup',
  'arrived_pickup',
  'picked_up',
  'en_route_delivery',
  'arrived_delivery',
] as const;

/** Booked or quoted but no driver yet: cancelled when the customer leaves. */
export const UNSTARTED_JOB_STATUSES = ['quote_requested', 'quoted', 'booked'] as const;

const DRIVER_DOCUMENT_COLUMNS = [
  'license_front_url',
  'license_back_url',
  'insurance_card_url',
  'registration_url',
  'vehicle_photo_front_url',
  'vehicle_photo_back_url',
  'vehicle_photo_side_url',
] as const;

export type DeletionResult =
  | { ok: true; mode: 'deleted' | 'anonymized' }
  | { ok: false; status: number; error: string };

export function deletedEmailFor(userId: string): string {
  // .invalid is reserved (RFC 2606) and can never receive mail.
  return `deleted-${userId}@deleted.epyccs.invalid`;
}

export async function deleteOwnAccount(admin: SupabaseClient, userId: string): Promise<DeletionResult> {
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (profile && ['admin', 'dispatcher'].includes(profile.role)) {
    return {
      ok: false,
      status: 403,
      error: 'Staff accounts are removed by an admin. Ask an admin to remove yours.',
    };
  }

  const { data: driver } = await admin
    .from('drivers')
    .select('id, ' + DRIVER_DOCUMENT_COLUMNS.join(', '))
    .eq('profile_id', userId)
    .maybeSingle();
  const driverRow = driver as unknown as (Record<string, string | null> & { id: string }) | null;

  // Open jobs block deletion, as the customer or as the driver.
  const { count: openAsCustomer } = await admin
    .from('deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', userId)
    .in('status', OPEN_JOB_STATUSES as unknown as string[]);
  let openAsDriver = 0;
  if (driverRow) {
    const { count } = await admin
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverRow.id)
      .in('status', OPEN_JOB_STATUSES as unknown as string[]);
    openAsDriver = count ?? 0;
  }
  if ((openAsCustomer ?? 0) > 0 || openAsDriver > 0) {
    return {
      ok: false,
      status: 409,
      error:
        'You have a delivery in progress. Finish it, or call Epyc at (818) 217-0070 to cancel it, then delete your account.',
    };
  }

  // Booked or quoted jobs with no driver yet are cancelled.
  await admin
    .from('deliveries')
    .update({ status: 'cancelled' })
    .eq('customer_id', userId)
    .in('status', UNSTARTED_JOB_STATUSES as unknown as string[]);

  // Document files go in both paths: the database cascade does not remove
  // storage objects.
  const files = new Set<string>();
  if (driverRow) {
    for (const col of DRIVER_DOCUMENT_COLUMNS) {
      const path = driverRow[col];
      if (isSafeStoragePath(path)) files.add(path);
    }
  }
  const { data: folder } = await admin.storage.from('driver-documents').list(`drivers/${userId}`, { limit: 1000 });
  for (const obj of folder ?? []) {
    const path = `drivers/${userId}/${obj.name}`;
    if (isSafeStoragePath(path)) files.add(path);
  }
  if (files.size > 0) {
    await admin.storage.from('driver-documents').remove([...files]);
  }

  // Path 1: try the full delete.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (!deleteError) return { ok: true, mode: 'deleted' };

  // Path 2: history keeps the rows, so wipe the personal details instead.
  const deadEmail = deletedEmailFor(userId);
  if (driverRow) {
    await admin.from('driver_locations').delete().eq('driver_id', driverRow.id);
    const wipe: Record<string, unknown> = {
      license_number: 'DELETED',
      vehicle_make: null,
      vehicle_model: null,
      vehicle_year: null,
      vehicle_plate: null,
      vehicle_vin: null,
      insurance_policy: null,
      current_lat: null,
      current_lng: null,
      is_online: false,
      status: 'inactive',
    };
    for (const col of DRIVER_DOCUMENT_COLUMNS) wipe[col] = null;
    await admin.from('drivers').update(wipe).eq('id', driverRow.id);
  }
  await admin.from('push_subscriptions').delete().eq('profile_id', userId);
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: 'Deleted account',
      email: deadEmail,
      phone: null,
      company_name: null,
      avatar_url: null,
    })
    .eq('id', userId);
  // Columns added by later migrations; ignored if a column is not there yet.
  await admin.from('profiles').update({ sms_opt_in: false, marketing_emails: false }).eq('id', userId);

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email: deadEmail,
    user_metadata: {},
    ban_duration: '876000h',
  });

  if (profileError || authError) {
    console.error('[account-deletion] anonymize failed', {
      profile: profileError?.message,
      auth: authError?.message,
    });
    return {
      ok: false,
      status: 500,
      error: 'We could not finish deleting your account. Email admin@epyccs.com and we will finish it within 30 days.',
    };
  }
  return { ok: true, mode: 'anonymized' };
}
