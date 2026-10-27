// Job offer rules shared by the dispatch offer dialog and the driver
// accept/decline route. Pure functions only (no Supabase, no React) so the
// decision logic is unit tested in job-offers.test.ts.

import { calculateDistance } from '@epyc/shared';

export const OFFER_EXPIRY_MINUTES = [15, 30, 60] as const;
export type OfferExpiryMinutes = (typeof OFFER_EXPIRY_MINUTES)[number];

export type OfferAction = 'accept' | 'decline';

export function parseOfferAction(body: unknown): OfferAction | null {
  if (!body || typeof body !== 'object') return null;
  const action = (body as { action?: unknown }).action;
  return action === 'accept' || action === 'decline' ? action : null;
}

export function offerExpiresAt(minutes: number, now: Date = new Date()): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/** Straight-line miles from the driver's last fix to the pickup, or null. */
export function distanceToPickupMiles(
  driver: { current_lat: number | null; current_lng: number | null },
  delivery: { pickup_lat: number | null; pickup_lng: number | null }
): number | null {
  if (
    driver.current_lat == null ||
    driver.current_lng == null ||
    delivery.pickup_lat == null ||
    delivery.pickup_lng == null
  ) {
    return null;
  }
  const miles = calculateDistance(
    { lat: Number(driver.current_lat), lng: Number(driver.current_lng) },
    { lat: Number(delivery.pickup_lat), lng: Number(delivery.pickup_lng) }
  );
  return Math.round(miles * 10) / 10;
}

export interface OfferRow {
  id: string;
  delivery_id: string;
  driver_id: string;
  status: string | null;
  expires_at: string;
}

export interface CallerDriver {
  id: string;
  status: string | null;
}

export interface OfferDelivery {
  id: string;
  status: string;
  driver_id: string | null;
}

export type OfferDecision =
  | { ok: true }
  | { ok: false; httpStatus: number; error: string };

/**
 * Checks, in the required order, whether the caller may respond to an offer:
 * driver is active, offer exists, offer belongs to the caller, offer is
 * pending, offer has not expired, and (accept only) the delivery is still
 * booked with no driver. The route re-checks the last condition atomically
 * with a conditional UPDATE; this is the fast, readable pre-check.
 */
export function evaluateOfferResponse(input: {
  action: OfferAction;
  driver: CallerDriver | null;
  offer: OfferRow | null;
  delivery: OfferDelivery | null;
  now?: Date;
}): OfferDecision {
  const { action, driver, offer, delivery } = input;
  const now = input.now ?? new Date();

  if (!driver || driver.status !== 'active') {
    return { ok: false, httpStatus: 403, error: 'Your driver account is not active' };
  }
  if (!offer) {
    return { ok: false, httpStatus: 404, error: 'Offer not found' };
  }
  if (offer.driver_id !== driver.id) {
    // Same answer as a missing offer, so ids of other drivers' offers do not leak.
    return { ok: false, httpStatus: 404, error: 'Offer not found' };
  }
  if (offer.status !== 'pending') {
    return { ok: false, httpStatus: 409, error: 'This offer is no longer open' };
  }
  if (new Date(offer.expires_at).getTime() <= now.getTime()) {
    return { ok: false, httpStatus: 410, error: 'This offer has expired' };
  }
  if (action === 'decline') {
    return { ok: true };
  }
  if (!delivery || delivery.id !== offer.delivery_id) {
    return { ok: false, httpStatus: 404, error: 'Job not found' };
  }
  if (delivery.status !== 'booked' || delivery.driver_id !== null) {
    return { ok: false, httpStatus: 409, error: 'Job already taken' };
  }
  return { ok: true };
}

/** One line for the driver card before acceptance; no contact details. */
export function packageSummary(d: {
  package_description: string | null;
  package_weight: number | null;
}): string {
  const parts: string[] = [];
  if (d.package_description) parts.push(d.package_description);
  if (d.package_weight != null) parts.push(`${d.package_weight} lbs`);
  return parts.join(' - ');
}
