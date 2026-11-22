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
      value: { deliveryId: ID, lat: 34.052235, lng: -118.243712, speed: 12.35, heading: 0, recordedAt: null },
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

describe('retentionCutoff', () => {
  it('is 90 days before now', async () => {
    const { retentionCutoff } = await import('./live-location');
    expect(retentionCutoff(Date.UTC(2026, 10, 20))).toBe('2026-08-22T00:00:00.000Z');
  });
});

describe('late fixes sent after a dead zone', () => {
  const NOW = Date.parse('2026-11-22T10:00:00Z');
  const base = { deliveryId: ID, lat: 34.05, lng: -118.24 };

  it('keeps the real time of a fix taken a few minutes ago', async () => {
    const { parseLocationBody: parse } = await import('./live-location');
    const r = parse({ ...base, recordedAt: '2026-11-22T09:55:00Z' }, NOW);
    expect(r.ok && r.value.recordedAt).toBe('2026-11-22T09:55:00.000Z');
  });

  it('ignores a fresh, future, too old or bad time', async () => {
    const { parseLocationBody: parse } = await import('./live-location');
    for (const recordedAt of ['2026-11-22T09:59:50Z', '2026-11-22T10:05:00Z', '2026-11-22T09:30:00Z', 'soon', 5]) {
      const r = parse({ ...base, recordedAt }, NOW);
      expect(r.ok && r.value.recordedAt).toBeNull();
    }
  });
});

describe('routeSummary and milesLabel', () => {
  it('sorts points, sums distance and skips bad rows', async () => {
    const { routeSummary } = await import('./live-location');
    const s = routeSummary([
      { lat: 34.01, lng: -118.24, recorded_at: '2026-11-22T10:02:00Z' },
      { lat: '34.00', lng: '-118.24', recorded_at: '2026-11-22T10:00:00Z' },
      { lat: 'x', lng: -118.24, recorded_at: '2026-11-22T10:01:00Z' },
      { lat: 34.02, lng: -118.24, recorded_at: null },
    ]);
    expect(s.points.map((p) => p.lat)).toEqual([34, 34.01]);
    expect(s.distanceMeters).toBeGreaterThan(1100);
    expect(s.distanceMeters).toBeLessThan(1120);
    expect(s.startedAt).toBe('2026-11-22T10:00:00Z');
    expect(s.lastAt).toBe('2026-11-22T10:02:00Z');
  });

  it('does not count a jump faster than a car can drive', async () => {
    const { routeSummary } = await import('./live-location');
    const s = routeSummary([
      { lat: 34, lng: -118, recorded_at: '2026-11-22T10:00:00Z' },
      { lat: 35, lng: -118, recorded_at: '2026-11-22T10:00:10Z' },
    ]);
    expect(s.distanceMeters).toBe(0);
  });

  it('is empty with no rows', async () => {
    const { routeSummary } = await import('./live-location');
    expect(routeSummary([])).toEqual({ points: [], distanceMeters: 0, startedAt: null, lastAt: null });
  });

  it('labels miles', async () => {
    const { milesLabel } = await import('./live-location');
    expect(milesLabel(0)).toBe('0.0 miles');
    expect(milesLabel(1609.344 * 2.34)).toBe('2.3 miles');
    expect(milesLabel(1609.344 * 12.6)).toBe('13 miles');
  });
});

describe('queueOfflineFix', () => {
  const T = Date.parse('2026-11-22T10:00:00Z');
  const fix = (atMs: number) => ({ lat: 34, lng: -118, speed: null, heading: null, atMs });

  it('keeps one fix a minute', async () => {
    const { queueOfflineFix } = await import('./live-location');
    let q = queueOfflineFix([], fix(T), T);
    q = queueOfflineFix(q, fix(T + 20_000), T + 20_000);
    q = queueOfflineFix(q, fix(T + 61_000), T + 61_000);
    expect(q.map((f) => f.atMs)).toEqual([T, T + 61_000]);
  });

  it('drops fixes older than 15 minutes and keeps at most 15', async () => {
    const { queueOfflineFix, OFFLINE_QUEUE_MAX } = await import('./live-location');
    let q: ReturnType<typeof queueOfflineFix> = [];
    for (let i = 0; i < 30; i++) q = queueOfflineFix(q, fix(T + i * 60_000), T + i * 60_000);
    expect(q.length).toBeLessThanOrEqual(OFFLINE_QUEUE_MAX);
    expect(q[q.length - 1].atMs).toBe(T + 29 * 60_000);
    expect(q[0].atMs).toBeGreaterThanOrEqual(T + 14 * 60_000);
  });
});
