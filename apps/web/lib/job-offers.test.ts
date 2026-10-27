import { describe, it, expect } from 'vitest';
import {
  evaluateOfferResponse,
  parseOfferAction,
  offerExpiresAt,
  distanceToPickupMiles,
  packageSummary,
  type OfferRow,
  type OfferDelivery,
} from './job-offers';

const now = new Date('2026-11-11T15:00:00Z');
const driver = { id: 'drv-1', status: 'active' };
const offer: OfferRow = {
  id: 'off-1',
  delivery_id: 'del-1',
  driver_id: 'drv-1',
  status: 'pending',
  expires_at: '2026-11-11T15:15:00Z',
};
const delivery: OfferDelivery = { id: 'del-1', status: 'booked', driver_id: null };

describe('evaluateOfferResponse', () => {
  it('allows an active driver to accept an open offer on a booked job', () => {
    expect(evaluateOfferResponse({ action: 'accept', driver, offer, delivery, now })).toEqual({
      ok: true,
    });
  });

  it('blocks a driver who is not active', () => {
    const r = evaluateOfferResponse({
      action: 'accept',
      driver: { id: 'drv-1', status: 'pending' },
      offer,
      delivery,
      now,
    });
    expect(r).toMatchObject({ ok: false, httpStatus: 403 });
    expect(evaluateOfferResponse({ action: 'accept', driver: null, offer, delivery, now })).toMatchObject({
      ok: false,
      httpStatus: 403,
    });
  });

  it('returns 404 for a missing offer or one owned by another driver', () => {
    expect(evaluateOfferResponse({ action: 'accept', driver, offer: null, delivery, now })).toMatchObject({
      httpStatus: 404,
    });
    expect(
      evaluateOfferResponse({
        action: 'decline',
        driver,
        offer: { ...offer, driver_id: 'drv-2' },
        delivery,
        now,
      })
    ).toMatchObject({ httpStatus: 404 });
  });

  it('rejects offers that are no longer pending', () => {
    for (const status of ['accepted', 'rejected', 'expired']) {
      expect(
        evaluateOfferResponse({ action: 'accept', driver, offer: { ...offer, status }, delivery, now })
      ).toMatchObject({ ok: false, httpStatus: 409 });
    }
  });

  it('rejects expired offers, including exactly at expiry', () => {
    expect(
      evaluateOfferResponse({
        action: 'accept',
        driver,
        offer: { ...offer, expires_at: now.toISOString() },
        delivery,
        now,
      })
    ).toMatchObject({ ok: false, httpStatus: 410 });
  });

  it('returns 409 Job already taken when the delivery has a driver or moved on', () => {
    expect(
      evaluateOfferResponse({
        action: 'accept',
        driver,
        offer,
        delivery: { ...delivery, driver_id: 'drv-9' },
        now,
      })
    ).toEqual({ ok: false, httpStatus: 409, error: 'Job already taken' });
    expect(
      evaluateOfferResponse({
        action: 'accept',
        driver,
        offer,
        delivery: { ...delivery, status: 'cancelled' },
        now,
      })
    ).toMatchObject({ httpStatus: 409 });
  });

  it('lets a driver decline even if the job was taken', () => {
    expect(
      evaluateOfferResponse({
        action: 'decline',
        driver,
        offer,
        delivery: { ...delivery, driver_id: 'drv-9', status: 'assigned' },
        now,
      })
    ).toEqual({ ok: true });
  });

  it('rejects a delivery that does not match the offer', () => {
    expect(
      evaluateOfferResponse({
        action: 'accept',
        driver,
        offer,
        delivery: { ...delivery, id: 'del-other' },
        now,
      })
    ).toMatchObject({ httpStatus: 404 });
  });
});

describe('helpers', () => {
  it('parses only accept or decline', () => {
    expect(parseOfferAction({ action: 'accept' })).toBe('accept');
    expect(parseOfferAction({ action: 'decline' })).toBe('decline');
    expect(parseOfferAction({ action: 'reject' })).toBeNull();
    expect(parseOfferAction(null)).toBeNull();
  });

  it('computes expiry', () => {
    expect(offerExpiresAt(30, now)).toBe('2026-11-11T15:30:00.000Z');
  });

  it('returns null distance without coordinates', () => {
    expect(
      distanceToPickupMiles(
        { current_lat: null, current_lng: null },
        { pickup_lat: 34, pickup_lng: -118 }
      )
    ).toBeNull();
    const d = distanceToPickupMiles(
      { current_lat: 34.05, current_lng: -118.25 },
      { pickup_lat: 34.18, pickup_lng: -118.31 }
    );
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(15);
  });

  it('summarizes package without contact details', () => {
    expect(packageSummary({ package_description: 'Box', package_weight: 12 })).toBe('Box - 12 lbs');
    expect(packageSummary({ package_description: null, package_weight: null })).toBe('');
  });
});
