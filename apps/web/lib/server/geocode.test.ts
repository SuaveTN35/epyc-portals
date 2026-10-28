// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CENSUS_BENCHMARK, geocodeAddress, oneLineAddress } from './geocode';

const ADDR = { street: '200 N Spring St', city: 'Los Angeles', state: 'CA', zip: '90012' };

type Handler = (url: URL) => unknown;
function fetchFrom(google: Handler, census: Handler) {
  const calls: URL[] = [];
  const impl = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const body = url.hostname === 'geocoding.geo.census.gov' ? census(url) : google(url);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const googleOk = (location_type = 'ROOFTOP') => () => ({
  status: 'OK',
  results: [{ geometry: { location: { lat: 34.0537, lng: -118.2428 }, location_type } }],
});
const censusOk = () => ({
  result: { addressMatches: [{ coordinates: { x: -118.2456, y: 34.0516 } }] },
});
const censusNone = () => ({ result: { addressMatches: [] } });

afterEach(() => vi.restoreAllMocks());

describe('oneLineAddress', () => {
  it('joins street, city, state and zip', () => {
    expect(oneLineAddress(ADDR)).toBe('200 N Spring St, Los Angeles, CA 90012');
  });
});

describe('geocodeAddress', () => {
  it('uses a street-level Google result and skips Census', async () => {
    const f = fetchFrom(googleOk(), censusOk);
    const r = await geocodeAddress(ADDR, { mapsKey: 'k', fetchImpl: f.impl });
    expect(r).toEqual({ ok: true, point: { lat: 34.0537, lng: -118.2428, source: 'google' } });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].searchParams.get('address')).toBe(oneLineAddress(ADDR));
  });

  it('falls back to Census on REQUEST_DENIED and logs status + error_message, never the key', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = fetchFrom(
      () => ({ status: 'REQUEST_DENIED', error_message: 'This API project is not authorized to use this API.' }),
      censusOk
    );
    const r = await geocodeAddress(ADDR, { mapsKey: 'secret-key', fetchImpl: f.impl });
    expect(r).toEqual({ ok: true, point: { lat: 34.0516, lng: -118.2456, source: 'census' } });
    const census = f.calls[1];
    expect(census.pathname).toBe('/geocoder/locations/onelineaddress');
    expect(census.searchParams.get('benchmark')).toBe(CENSUS_BENCHMARK);
    expect(census.searchParams.get('format')).toBe('json');
    const logged = JSON.stringify(err.mock.calls);
    expect(logged).toMatch(/REQUEST_DENIED/);
    expect(logged).toMatch(/not authorized/);
    expect(logged).not.toMatch(/secret-key/);
    expect(logged).not.toMatch(/Spring/);
  });

  it('uses Census only when there is no key', async () => {
    const f = fetchFrom(() => {
      throw new Error('google must not be called');
    }, censusOk);
    const r = await geocodeAddress(ADDR, { mapsKey: null, fetchImpl: f.impl });
    expect(r.ok && r.point.source).toBe('census');
  });

  it('prefers Census over a Google APPROXIMATE (zip centroid) result, and uses it only as a last resort', async () => {
    const a = fetchFrom(googleOk('APPROXIMATE'), censusOk);
    const r1 = await geocodeAddress(ADDR, { mapsKey: 'k', fetchImpl: a.impl });
    expect(r1.ok && r1.point.source).toBe('census');
    const b = fetchFrom(googleOk('APPROXIMATE'), censusNone);
    const r2 = await geocodeAddress(ADDR, { mapsKey: 'k', fetchImpl: b.impl });
    expect(r2.ok && r2.point.source).toBe('google_approximate');
  });

  it('no_match when providers answer with nothing', async () => {
    const f = fetchFrom(() => ({ status: 'ZERO_RESULTS', results: [] }), censusNone);
    expect(await geocodeAddress(ADDR, { mapsKey: 'k', fetchImpl: f.impl })).toEqual({
      ok: false,
      reason: 'no_match',
    });
  });

  it('unavailable when every provider errors; never throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = fetchFrom(
      () => new Error('network'),
      () => new Error('timeout')
    );
    expect(await geocodeAddress(ADDR, { mapsKey: 'k', fetchImpl: f.impl })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('treats a non-200 Census answer or an odd shape as an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await geocodeAddress(ADDR, { mapsKey: null, fetchImpl: bad })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    const odd = fetchFrom(() => ({}), () => ({ nope: true }));
    expect(await geocodeAddress(ADDR, { mapsKey: null, fetchImpl: odd.impl })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
