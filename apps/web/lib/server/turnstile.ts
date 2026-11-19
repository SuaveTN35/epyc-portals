/**
 * Cloudflare Turnstile check for the public forms.
 *
 * - TURNSTILE_SECRET_KEY not set: the check is off and every request passes,
 *   so this code can ship before the keys exist.
 * - Key set and no token, or Cloudflare says the token is bad: blocked.
 * - Key set but Cloudflare cannot be reached (timeout, network error, 5xx):
 *   allowed, with a log line. The shared rate limit still applies, and a
 *   Cloudflare outage should not stop real customers from booking.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { ok: true; reason: 'disabled' | 'verified' | 'unreachable' }
  | { ok: false; reason: 'missing' | 'rejected' };

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/** Pull the token out of a parsed JSON body without trusting its shape. */
export function tokenFrom(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const t = (body as Record<string, unknown>).turnstile_token;
  return typeof t === 'string' && t.length > 0 && t.length <= 2048 ? t : null;
}

export async function verifyTurnstile(token: string | null, ip?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, reason: 'disabled' };
  if (!token) return { ok: false, reason: 'missing' };

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (ip && !ip.startsWith('ua:')) form.set('remoteip', ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(3000),
    });
    if (res.status >= 500) {
      console.error('[turnstile] verify unavailable, status', res.status);
      return { ok: true, reason: 'unreachable' };
    }
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (data.success === true) return { ok: true, reason: 'verified' };
    console.warn('[turnstile] rejected:', (data['error-codes'] || []).join(','));
    return { ok: false, reason: 'rejected' };
  } catch (e) {
    console.error('[turnstile] verify unreachable:', (e as Error).message);
    return { ok: true, reason: 'unreachable' };
  }
}
