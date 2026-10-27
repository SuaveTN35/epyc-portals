// Server-only SMS sender (Twilio REST API over fetch; no SDK dependency).
// Never import from a client component: it reads the Twilio auth token.
//
// Every function here resolves; none throws into the caller. A failed text
// must never fail the dispatch or driver action that triggered it.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TWILIO_UNSUBSCRIBED_CODE,
  normalizePhone,
  smsConfigFrom,
  twilioRequest,
  withOptOutFooter,
  type SmsKind,
} from '@/lib/sms';

export type SmsResult =
  | 'sent'
  | 'not_configured'
  | 'skipped_no_consent'
  | 'skipped_no_phone'
  | 'skipped_duplicate'
  | 'failed';

interface SendArgs {
  admin: SupabaseClient; // service-role client, used for sms_log and profile reads
  to: string | null | undefined;
  body: string;
  kind: SmsKind;
  profileId?: string | null;
  deliveryId?: string | null;
  /** Append "Reply STOP to opt out." if this number has never been texted. */
  optOutFooterOnFirst?: boolean;
}

async function logSms(
  admin: SupabaseClient,
  row: {
    to_number: string;
    profile_id: string | null;
    kind: SmsKind;
    delivery_id: string | null;
    twilio_sid: string | null;
    status: string;
  }
) {
  try {
    const { error } = await admin.from('sms_log').insert(row);
    if (error) console.error('[sms] log insert failed:', error.message);
  } catch (e) {
    console.error('[sms] log insert threw:', e instanceof Error ? e.message : e);
  }
}

async function hasBeenTextedBefore(admin: SupabaseClient, to: string): Promise<boolean> {
  try {
    const { count, error } = await admin
      .from('sms_log')
      .select('id', { count: 'exact', head: true })
      .eq('to_number', to)
      .not('twilio_sid', 'is', null);
    if (error) return false; // fail toward including the opt-out footer
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Send one text. Resolves to a result code; never throws. */
export async function sendSms(args: SendArgs): Promise<SmsResult> {
  const config = smsConfigFrom(process.env);
  if (!config) {
    console.info('[sms] SMS not configured; skipped', args.kind);
    return 'not_configured';
  }

  const to = normalizePhone(args.to);
  if (!to) return 'skipped_no_phone';

  try {
    const first = args.optOutFooterOnFirst ? !(await hasBeenTextedBefore(args.admin, to)) : false;
    const body = withOptOutFooter(args.body, first);
    const { url, init } = twilioRequest(config, to, body);

    const res = await fetch(url, { ...init, cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; code?: number };

    if (!res.ok) {
      const code = typeof json.code === 'number' ? json.code : res.status;
      console.error('[sms] Twilio rejected message', args.kind, code);
      await logSms(args.admin, {
        to_number: to,
        profile_id: args.profileId ?? null,
        kind: args.kind,
        delivery_id: args.deliveryId ?? null,
        twilio_sid: null,
        status: `failed:${code}`,
      });
      // The driver replied STOP at some point: honor it in our own records too.
      if (code === TWILIO_UNSUBSCRIBED_CODE && args.profileId) {
        await args.admin.from('profiles').update({ sms_opt_in: false }).eq('id', args.profileId);
      }
      return 'failed';
    }

    await logSms(args.admin, {
      to_number: to,
      profile_id: args.profileId ?? null,
      kind: args.kind,
      delivery_id: args.deliveryId ?? null,
      twilio_sid: json.sid ?? null,
      status: json.status ?? 'queued',
    });
    return 'sent';
  } catch (e) {
    console.error('[sms] send threw:', e instanceof Error ? e.message : e);
    await logSms(args.admin, {
      to_number: to,
      profile_id: args.profileId ?? null,
      kind: args.kind,
      delivery_id: args.deliveryId ?? null,
      twilio_sid: null,
      status: 'failed:network',
    });
    return 'failed';
  }
}

/** True when this profile was already sent this kind of text for this job recently. */
export async function recentlyTexted(
  admin: SupabaseClient,
  opts: { kind: SmsKind; deliveryId: string; profileId?: string | null; withinMinutes: number }
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - opts.withinMinutes * 60_000).toISOString();
    let q = admin
      .from('sms_log')
      .select('id', { count: 'exact', head: true })
      .eq('kind', opts.kind)
      .eq('delivery_id', opts.deliveryId)
      .gte('created_at', since);
    if (opts.profileId) q = q.eq('profile_id', opts.profileId);
    const { count, error } = await q;
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Text a driver, but only if they opted in (profiles.sms_opt_in) and have a
 * phone on file. Never throws.
 */
export async function sendDriverSms(args: {
  admin: SupabaseClient;
  profileId: string;
  kind: SmsKind;
  deliveryId: string;
  body: string;
}): Promise<SmsResult> {
  if (!smsConfigFrom(process.env)) {
    console.info('[sms] SMS not configured; skipped', args.kind);
    return 'not_configured';
  }
  try {
    const { data: profile } = await args.admin
      .from('profiles')
      .select('phone, sms_opt_in')
      .eq('id', args.profileId)
      .maybeSingle();
    if (!profile || profile.sms_opt_in !== true) return 'skipped_no_consent';
    if (!normalizePhone(profile.phone)) return 'skipped_no_phone';
    if (await recentlyTexted(args.admin, { kind: args.kind, deliveryId: args.deliveryId, profileId: args.profileId, withinMinutes: 10 })) {
      return 'skipped_duplicate';
    }
    return await sendSms({
      admin: args.admin,
      to: profile.phone,
      body: args.body,
      kind: args.kind,
      profileId: args.profileId,
      deliveryId: args.deliveryId,
      optOutFooterOnFirst: true,
    });
  } catch (e) {
    console.error('[sms] driver text failed:', e instanceof Error ? e.message : e);
    return 'failed';
  }
}
