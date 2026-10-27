// Pure SMS helpers (no network, no env reads at import). The sender is
// lib/server/sms.ts. Message rule: no customer names, street addresses, or
// medical details in any text. Cities, payout, and links only.

export const SMS_SITE_URL = 'https://www.epyccs.com';
export const SMS_OPT_OUT_FOOTER = 'Reply STOP to opt out.';
export const SMS_CONSENT_TEXT = 'Text me job offers and updates. Msg and data rates may apply. Reply STOP to opt out.';

export type SmsKind = 'job_offer' | 'job_assigned' | 'problem_ops';

/**
 * Normalize a phone number to E.164. Ten digits are treated as US (+1).
 * Returns null when the input cannot be a valid number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (hasPlus) {
    // Already international: E.164 allows up to 15 digits, country code first.
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
    if (digits.startsWith('1') && digits.length !== 11) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return isNanp(digits) ? `+1${digits}` : null;
  if (digits.length === 11 && digits.startsWith('1')) return isNanp(digits.slice(1)) ? `+${digits}` : null;
  return null;
}

/** NANP: area code and exchange cannot start with 0 or 1. */
function isNanp(ten: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten);
}

/** Keep a city label short and plain: printable characters only, 40 max. */
export function cleanCity(city: string | null | undefined, fallback: string): string {
  const c = typeof city === 'string' ? city.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return c ? c.slice(0, 40) : fallback;
}

export function formatPayout(payout: number | string | null | undefined): string | null {
  if (payout === null || payout === undefined || payout === '') return null;
  const n = typeof payout === 'number' ? payout : Number(payout);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export function offerText(input: {
  pickupCity: string | null | undefined;
  dropoffCity: string | null | undefined;
  payout: number | string | null | undefined;
}): string {
  const pay = formatPayout(input.payout);
  const from = cleanCity(input.pickupCity, 'pickup');
  const to = cleanCity(input.dropoffCity, 'drop-off');
  return `EPYC: New job offer - ${from} to ${to}${pay ? `, ${pay}` : ''}. Open the app to accept: ${SMS_SITE_URL}/driver/jobs`;
}

export function assignedText(deliveryId: string): string {
  return `EPYC: You've been assigned a job. Open: ${SMS_SITE_URL}/driver/delivery/${encodeURIComponent(deliveryId)}`;
}

/** Ops alert. The driver's free-text note is never included (it may name a customer). */
export function problemOpsText(input: { reasonLabel: string; deliveryId: string; jobRef?: string | null }): string {
  const ref = input.jobRef && /^[A-Za-z0-9-]{1,32}$/.test(input.jobRef) ? input.jobRef : input.deliveryId.slice(0, 8);
  return `EPYC: Driver reported a problem on job ${ref}: ${input.reasonLabel}. Open: ${SMS_SITE_URL}/dispatch/deliveries/${encodeURIComponent(input.deliveryId)}`;
}

export function withOptOutFooter(body: string, isFirstText: boolean): string {
  return isFirstText ? `${body} ${SMS_OPT_OUT_FOOTER}` : body;
}

export type SmsConfig =
  | { accountSid: string; authToken: string; from: string; messagingServiceSid?: undefined }
  | { accountSid: string; authToken: string; messagingServiceSid: string; from?: undefined };

/** Read Twilio settings from an env-like object. Null when SMS is not configured. */
export function smsConfigFrom(env: Record<string, string | undefined>): SmsConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) return null;
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (messagingServiceSid) return { accountSid, authToken, messagingServiceSid };
  const from = normalizePhone(env.TWILIO_PHONE_NUMBER);
  if (from) return { accountSid, authToken, from };
  return null;
}

/** URL, headers, and form body for Twilio's Create Message REST call. */
export function twilioRequest(config: SmsConfig, to: string, body: string) {
  const form = new URLSearchParams({ To: to, Body: body });
  if (config.messagingServiceSid) form.set('MessagingServiceSid', config.messagingServiceSid);
  else if (config.from) form.set('From', config.from);
  const basic =
    typeof btoa === 'function'
      ? btoa(`${config.accountSid}:${config.authToken}`)
      : Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    },
  };
}

/** Twilio error 21610: the recipient replied STOP. */
export const TWILIO_UNSUBSCRIBED_CODE = 21610;

// ------------------------------------------------------------ request parsing

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_OFFER_SMS_DRIVERS = 50;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Body of POST /api/dispatch/sms/offer: { delivery_id, driver_ids: [] }. */
export function parseOfferSmsRequest(
  body: unknown
): { ok: true; deliveryId: string; driverIds: string[] } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!isUuid(b.delivery_id)) return { ok: false, error: 'Invalid delivery' };
  if (!Array.isArray(b.driver_ids) || b.driver_ids.length === 0) return { ok: false, error: 'No drivers' };
  if (b.driver_ids.length > MAX_OFFER_SMS_DRIVERS) return { ok: false, error: 'Too many drivers' };
  if (!b.driver_ids.every(isUuid)) return { ok: false, error: 'Invalid driver' };
  return { ok: true, deliveryId: b.delivery_id, driverIds: Array.from(new Set(b.driver_ids as string[])) };
}

/** Body of POST /api/dispatch/sms/assigned: { delivery_id }. */
export function parseAssignedSmsRequest(body: unknown): { ok: true; deliveryId: string } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!isUuid(b.delivery_id)) return { ok: false, error: 'Invalid delivery' };
  return { ok: true, deliveryId: b.delivery_id };
}
