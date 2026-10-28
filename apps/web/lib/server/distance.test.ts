import { describe, it, expect, vi } from 'vitest';
import {
  computeRouteDistance,
  formatDuration,
  haversineDrivingMiles,
  RouteNotFoundError,
} from './distance';

const A = { lat: 34.0522, lng: -118.2437 };
const B = { lat: 34.0195, lng: -118.4912 };

const jsonFetch = (body: unknown) =>
  vi.fn(async () => ({ json: async () => body }) as unknown as Response) as unknown as typeof fetch;

describe('computeRouteDistance', () => {
  it('uses haversine x 1.3 with no maps key', async () => {
    const r = await computeRouteDistance(A, B, { mapsKey: null });
    expect(r.source).toBe('haversine');
    expect(r.distance_miles).toBe(Math.round(haversineDrivingMiles(A, B) * 10) / 10);
    expect(r.distance_miles).toBeGreaterThan(14);
    expect(r.distance_miles).toBeLessThan(20);
  });

  it('uses Google distance when the matrix answers OK', async () => {
    const fetchImpl = jsonFetch({
      status: 'OK',
      rows: [
        {
          elements: [
            {
              status: 'OK',
              distance: { value: 16093.44, text: '10.0 mi' },
              duration: { value: 1800, text: '30 mins' },
            },
          ],
        },
      ],
    });
    const r = await computeRouteDistance(A, B, { mapsKey: 'k', fetchImpl });
    expect(r).toMatchObject({ distance_miles: 10, duration_minutes: 30, source: 'google' });
  });

  it('falls back to haversine on a non-OK matrix status or a network error', async () => {
    const r1 = await computeRouteDistance(A, B, {
      mapsKey: 'k',
      fetchImpl: jsonFetch({ status: 'REQUEST_DENIED' }),
    });
    expect(r1.source).toBe('haversine_fallback');
    const boom = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const r2 = await computeRouteDistance(A, B, { mapsKey: 'k', fetchImpl: boom });
    expect(r2.source).toBe('haversine_fallback');
  });

  it('logs the matrix status and error_message, never the key', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await computeRouteDistance(A, B, {
      mapsKey: 'secret-key',
      fetchImpl: jsonFetch({ status: 'REQUEST_DENIED', error_message: 'API keys with referer restrictions cannot be used with this API.' }),
    });
    const logged = JSON.stringify(err.mock.calls);
    expect(logged).toMatch(/REQUEST_DENIED/);
    expect(logged).toMatch(/referer restrictions/);
    expect(logged).not.toMatch(/secret-key/);
    err.mockRestore();
  });

  it('throws RouteNotFoundError when Google has no route', async () => {
    const fetchImpl = jsonFetch({ status: 'OK', rows: [{ elements: [{ status: 'ZERO_RESULTS' }] }] });
    await expect(computeRouteDistance(A, B, { mapsKey: 'k', fetchImpl })).rejects.toBeInstanceOf(
      RouteNotFoundError
    );
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(95)).toBe('1 hr 35 min');
  });
});
