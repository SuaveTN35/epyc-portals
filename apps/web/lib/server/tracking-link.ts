// Server-only: signed public tracking links for clients.
//
// A link looks like https://www.epyccs.com/track/<delivery id>/<signature>.
// The signature is an HMAC of the delivery id with CLIENT_TRACKING_SECRET, so
// a link cannot be guessed from a delivery id or a tracking number. Anyone
// holding the link sees that one job's status page (no addresses, no names).
// With no secret set, no link is made and alerts point to the client portal.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { SMS_SITE_URL } from '@/lib/sms';
import { isUuid } from '@/lib/sms';

const SIG_LENGTH = 22; // base64url chars, about 132 bits

function secretFrom(env: Record<string, string | undefined>): string | null {
  const s = env.CLIENT_TRACKING_SECRET?.trim();
  // Refuse short secrets: a weak key makes every link guessable.
  return s && s.length >= 32 ? s : null;
}

export function trackingSignature(deliveryId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`track:${deliveryId.toLowerCase()}`)
    .digest('base64url')
    .slice(0, SIG_LENGTH);
}

/** The public tracking link for a job, or null when tracking links are not set up. */
export function trackingLink(
  deliveryId: string,
  env: Record<string, string | undefined> = process.env
): string | null {
  const secret = secretFrom(env);
  if (!secret || !isUuid(deliveryId)) return null;
  return `${SMS_SITE_URL}/track/${deliveryId.toLowerCase()}/${trackingSignature(deliveryId, secret)}`;
}

/** True only when the signature matches this delivery id. Constant-time compare. */
export function verifyTrackingSignature(
  deliveryId: string,
  signature: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  const secret = secretFrom(env);
  if (!secret || !isUuid(deliveryId)) return false;
  if (typeof signature !== 'string' || !/^[A-Za-z0-9_-]+$/.test(signature)) return false;
  const expected = Buffer.from(trackingSignature(deliveryId, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
