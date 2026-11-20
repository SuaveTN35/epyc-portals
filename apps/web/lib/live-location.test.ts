import { describe, expect, it } from 'vitest';
import {
  MAX_SEND_INTERVAL_MS,
  MIN_SEND_INTERVAL_MS,
  distanceMeters,
  isLiveTrackingStatus,
  isLocationFresh,
  latestPerDriver,
  locationAgeLabel,
  mapsLink,
  parseLocationBody,
  shouldSendLocation,
} from './live-location';

const LA = { lat: 34.0522, lng: -118.2437 };
const ID = '3f2b6c1e-8a4d-4f2a-9b7c-1d2e3f4a5b6c';

describe('isLiveTrackingStatus', () => {
  it('is on from assigned through arrived at drop-off only', () => {
    expect(isLiveTrackingStatus('assigned')).toBe(true);
    expect(isLiveTrackingStatus('picked_up')).toBe(true);
    expect(isLiveTrackingStatus('arrived_delivery')).toBe(true);
    expect(isLiveTrackingStatus('booked')).toBe(false);
    expect(isLiveTrackingStatus('delivered')).toBe(false);
    expect(isLiveTrackingStatus('cancelled')).toBe(false);
    expect(isLiveTrackingStatus(null)).toBe(false);
  });
});

describe('distanceMeters', () => {
  it('is about 111 km per degree of latitude', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(110_000);
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeLessThan(112_000);
    expect(distanceMeters(LA, LA)).toBe(0);
  });
});

describe('shouldSendLocation', () => {
  const now = 1_000_000;
  it('sends the first fix', () => {
    expect(shouldSendLocation(null, LA, now)).toBe(true);
  });
  it('never sends twice inside the minimum interval', () => {
    const far = { lat: LA.lat + 0.01, lng: LA.lng };
    expect(shouldSendLocation({ ...LA, atMs: now - MIN_SEND_INTERVAL_MS + 1 }, far, now)).toBe(false);
  });
  it('sends after moving far enough', () => {
    const moved = { lat: LA.lat + 0.0005, lng: LA.lng }; // about 55 m
    expect(shouldSendLocation({ ...LA, atMs: now - MIN_SEND_INTERVAL_MS }, moved, now)).toBe(true);
  });
  it('skips a parked phone until the maximum interval', () => {
    expect(shouldSendLocation({ ...LA, atMs: now - 30_000 }, LA, now)).toBe(false);
    expect(shouldSendLocation({ ...LA, atMs: now - MAX_SEND_INTERVAL_MS }, LA, now)).toBe(true);
  });
});

describe('parseLocationBody', () => {
  it('accepts a good fix and rounds it', () => {
    const r = parseLocationBody({ deliveryId: ID.toUpperCase(), lat: 34.05223456789, lng: -118.24371234, speed: 12.345, heading: 359.7 });
    expect(r).toEqual({
      ok: true,
      value: { deliveryId: ID, lat: 34.052235, lng: -118.243712, speed: 12.35, heading: 0 },
    });
  });
  it('allows a fix with no job', () => {
    const r = parseLocationBody({ lat: 34, lng: -118 });
    expect(r.ok && r.value.deliveryId).toBe(null);
  });
  it('rejects bad coordinates, rough fixes and bad job ids', () => {
    expect(parseLocationBody(null).ok).toBe(false);
    expect(parseLocationBody({ lat: '34', lng: -118 }).ok).toBe(false);
    expect(parseLocationBody({ lat: 91, lng: 0 }).ok).toBe(false);
    expect(parseLocationBody({ lat: 0, lng: 0 }).ok).toBe(false);
    expect(parseLocationBody({ lat: Number.NaN, lng: 1 }).ok).toBe(false);
    expect(parseLocationBody({ lat: 34, lng: -118, accuracy: 2000 }).ok).toBe(false);
    expect(parseLocationBody({ lat: 34, lng: -118, deliveryId: 'abc' }).ok).toBe(false);
  });
  it('drops negative or impossible speed and heading', () => {
    const r = parseLocationBody({ lat: 34, lng: -118, speed: -1, heading: -5 });
    expect(r.ok && [r.value.speed, r.value.heading]).toEqual([null, null]);
    const big = parseLocationBody({ lat: 34, lng: -118, speed: 5000 });
    expect(big.ok && big.value.speed).toBe(999.99);
  });
});

describe('isLocationFresh and locationAgeLabel', () => {
  const now = Date.parse('2026-11-20T20:00:00Z');
  it('is fresh within 15 minutes', () => {
    expect(isLocationFresh('2026-11-20T19:50:00Z', now)).toBe(true);
    expect(isLocationFresh('2026-11-20T19:40:00Z', now)).toBe(false);
    expect(isLocationFresh(null, now)).toBe(false);
    expect(isLocationFresh('nonsense', now)).toBe(false);
    expect(isLocationFresh('2026-11-20T20:10:00Z', now)).toBe(false);
  });
  it('labels the age in plain words', () => {
    expect(locationAgeLabel('2026-11-20T19:59:30Z', now)).toBe('just now');
    expect(locationAgeLabel('2026-11-20T19:58:00Z', now)).toBe('2 min ago');
    expect(locationAgeLabel('2026-11-20T18:00:00Z', now)).toBe('2 hr ago');
    expect(locationAgeLabel(null, now)).toBe('not yet');
  });
});

describe('latestPerDriver', () => {
  it('keeps the newest row for each driver', () => {
    const rows = [
      { driver_id: 'a', recorded_at: '2026-11-20T10:00:00Z', n: 1 },
      { driver_id: 'a', recorded_at: '2026-11-20T10:05:00Z', n: 2 },
      { driver_id: 'b', recorded_at: '2026-11-20T09:00:00Z', n: 3 },
    ];
    expect(latestPerDriver(rows).map((r) => r.n).sort()).toEqual([2, 3]);
  });
});

describe('mapsLink', () => {
  it('links one point', () => {
    expect(mapsLink(LA)).toBe('https://www.google.com/maps/search/?api=1&query=34.052200,-118.243700');
  });
});
