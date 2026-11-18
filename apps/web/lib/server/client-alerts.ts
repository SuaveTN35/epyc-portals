// Server-only: send the client who booked a job a text and an email when a
// driver is assigned, when the package is picked up, and when it is delivered.
//
// Rules:
//   * The alert is chosen from the job's status in the database, never from
//     the request (clientEventForStatus).
//   * Each (job, alert, channel) goes out at most once. A row in client_alerts
//     is claimed before sending; the unique index turns a second claim (a
//     retry, a double tap, two dispatchers) into a quiet skip.
//   * Only real client accounts on Epyc's own jobs get alerts, never staff
//     (dispatch-made jobs use the dispatcher as customer for now), drivers,
//     or partner-platform jobs (shouldAlertClient).
//   * Email goes out unless the client turned email updates off. Texts go out
//     only when the client turned texts on (profiles.sms_opt_in).
//   * Nothing here throws into the caller. A failed alert must never fail the
//     driver or dispatch action that triggered it.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CLIENT_SMS_KIND,
  clientAlertText,
  clientEventForStatus,
  cleanReceivedBy,
  portalLink,
  shouldAlertClient,
  type ClientAlertEvent,
  type ClientAlertJob,
} from '@/lib/client-alerts';
import { clientDeliveryAlertEmail, sendEmail } from '@/lib/email';
import { normalizePhone, smsConfigFrom } from '@/lib/sms';
import { sendSms } from '@/lib/server/sms';
import { trackingLink } from '@/lib/server/tracking-link';

export type ChannelResult =
  | 'sent'
  | 'failed'
  | 'duplicate'
  | 'not_configured'
  | 'turned_off'
  | 'no_contact'
  | 'not_a_client'
  | 'not_ready';

export interface ClientAlertResult {
  event: ClientAlertEvent | null;
  email: ChannelResult | null;
  sms: ChannelResult | null;
}

const UNIQUE_VIOLATION = '23505';

type Claim = { ok: true; id: string } | { ok: false; result: ChannelResult };

async function claim(
  admin: SupabaseClient,
  deliveryId: string,
  event: ClientAlertEvent,
  channel: 'email' | 'sms'
): Promise<Claim> {
  try {
    const { data, error } = await admin
      .from('client_alerts')
      .insert({ delivery_id: deliveryId, event, channel, status: 'sending' })
      .select('id')
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { ok: false, result: 'duplicate' };
      // Table missing (migration not applied) or another error: send nothing,
      // because without the claim row a retry could send it twice.
      console.error('[client-alerts] claim failed:', error.message);
      return { ok: false, result: 'not_ready' };
    }
    return { ok: true, id: data.id as string };
  } catch (e) {
    console.error('[client-alerts] claim threw:', e instanceof Error ? e.message : e);
    return { ok: false, result: 'not_ready' };
  }
}

async function finish(admin: SupabaseClient, id: string, status: string, providerId: string | null) {
  try {
    const { error } = await admin
      .from('client_alerts')
      .update({ status, provider_id: providerId })
      .eq('id', id);
    if (error) console.error('[client-alerts] status update failed:', error.message);
  } catch (e) {
    console.error('[client-alerts] status update threw:', e instanceof Error ? e.message : e);
  }
}

interface DeliveryRow extends ClientAlertJob {
  status: string;
  customer_id: string;
  source: string | null;
}

interface ProfileRow {
  role: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  sms_opt_in: boolean | null;
  email_notifications: boolean | null;
}

async function loadProfile(admin: SupabaseClient, customerId: string): Promise<ProfileRow | null> {
  const full = await admin
    .from('profiles')
    .select('role, email, full_name, phone, sms_opt_in, email_notifications')
    .eq('id', customerId)
    .maybeSingle();
  if (!full.error) return (full.data as ProfileRow | null) ?? null;
  // Before migration 20261118000100 there is no email_notifications column.
  // Read without it and treat email updates as on (the default).
  const basic = await admin
    .from('profiles')
    .select('role, email, full_name, phone, sms_opt_in')
    .eq('id', customerId)
    .maybeSingle();
  if (basic.error || !basic.data) return null;
  return { ...(basic.data as Omit<ProfileRow, 'email_notifications'>), email_notifications: true };
}

async function receivedByFor(admin: SupabaseClient, deliveryId: string): Promise<string | null> {
  const { data } = await admin
    .from('proof_of_delivery')
    .select('recipient_name')
    .eq('delivery_id', deliveryId)
    .eq('stage', 'delivery')
    .not('recipient_name', 'is', null)
    .limit(1);
  return cleanReceivedBy(data?.[0]?.recipient_name ?? null);
}

function isEmail(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/**
 * Send whatever client alert the job's current status calls for. Safe to call
 * more than once for the same job and status. Never throws.
 */
export async function notifyClient(admin: SupabaseClient, deliveryId: string): Promise<ClientAlertResult> {
  const none: ClientAlertResult = { event: null, email: null, sms: null };
  try {
    const { data: delivery } = await admin
      .from('deliveries')
      .select(
        'id, status, customer_id, source, tracking_number, pickup_city, delivery_city, actual_pickup_time, actual_delivery_time'
      )
      .eq('id', deliveryId)
      .maybeSingle();
    if (!delivery) return none;
    const job = delivery as DeliveryRow;

    const event = clientEventForStatus(job.status);
    if (!event) return none;

    const profile = await loadProfile(admin, job.customer_id);
    if (!profile) return { event, email: 'no_contact', sms: 'no_contact' };
    if (!shouldAlertClient(job, profile)) return { event, email: 'not_a_client', sms: 'not_a_client' };

    const link = trackingLink(job.id) ?? portalLink(job.id);
    const [email, sms] = await Promise.all([
      sendClientEmail(admin, job, event, profile, link),
      sendClientSms(admin, job, event, profile, link),
    ]);
    return { event, email, sms };
  } catch (e) {
    console.error('[client-alerts] notify failed:', e instanceof Error ? e.message : e);
    return none;
  }
}

async function sendClientEmail(
  admin: SupabaseClient,
  job: DeliveryRow,
  event: ClientAlertEvent,
  profile: ProfileRow,
  link: string
): Promise<ChannelResult> {
  if (profile.email_notifications === false) return 'turned_off';
  if (!isEmail(profile.email)) return 'no_contact';
  if (!process.env.RESEND_API_KEY) return 'not_configured';

  const claimed = await claim(admin, job.id, event, 'email');
  if (!claimed.ok) return claimed.result;

  const receivedBy = event === 'delivered' ? await receivedByFor(admin, job.id) : null;
  const message = clientDeliveryAlertEmail({ event, job, link, firstName: profile.full_name, receivedBy });
  const res = await sendEmail({ to: profile.email.trim(), ...message });
  await finish(admin, claimed.id, res.sent ? 'sent' : `failed:${res.error ?? res.skipped ?? 'unknown'}`, res.id ?? null);
  return res.sent ? 'sent' : 'failed';
}

async function sendClientSms(
  admin: SupabaseClient,
  job: DeliveryRow,
  event: ClientAlertEvent,
  profile: ProfileRow,
  link: string
): Promise<ChannelResult> {
  if (profile.sms_opt_in !== true) return 'turned_off';
  if (!normalizePhone(profile.phone)) return 'no_contact';
  if (!smsConfigFrom(process.env)) return 'not_configured';

  const claimed = await claim(admin, job.id, event, 'sms');
  if (!claimed.ok) return claimed.result;

  const result = await sendSms({
    admin,
    to: profile.phone,
    body: clientAlertText(event, job, link),
    kind: CLIENT_SMS_KIND[event],
    profileId: job.customer_id,
    deliveryId: job.id,
    optOutFooterOnFirst: true,
  });
  await finish(admin, claimed.id, result, null);
  return result === 'sent' ? 'sent' : 'failed';
}
