// Server-side geocoding of the address TEXT (P-362).
//
// The driver drives to the address text, so the customer price must come
// from where that text is, not from coordinates the browser sends. This
// helper turns street/city/state/zip into a point on the server.
//
// Order:
//   1. Google Geocoding API (same key resolution as distance.ts). Street-level
//      results (location_type ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER)
//      are used at once.
//   2. US Census Bureau geocoder (no key): onelineaddress, benchmark
//      Public_AR_Current, format json. Answers only street-range matches.
//   3. A Google APPROXIMATE result (zip or city centroid), only if Census had
//      no match. It still comes from the address text, never the browser.
// Each call has a short timeout. Nothing here throws: failures return
// { ok: false } with a reason so the route can answer the customer cleanly.
// Logs carry provider status and error_message only: never the key, never
// the address.

import { googleMapsServerKey } from './distance';

export const GEOCODE_TIMEOUT_MS = 4000;
export const CENSUS_GEOCODER_URL =
  'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
export const CENSUS_BENCHMARK = 'Public_AR_Current';

export interface AddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export type GeocodeSource = 'google' | 'census' | 'google_approximate';

export interface GeocodePoint {
  lat: number;
  lng: number;
  source: GeocodeSource;
}

/**
 * no_match: a provider answered and found nothing usable (customer should
 * check the address). unavailable: every provider errored or timed out
 * (customer should retry or call).
 */
export type GeocodeResult =
  | { ok: true; point: GeocodePoint }
  | { ok: false; reason: 'no_match' | 'unavailable' };

export interface GeocodeOptions {
  /** Pass null to skip Google (tests, or no key). Omit to read the environment. */
  mapsKey?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function oneLineAddress(a: AddressParts): string {
  return [a.street, a.city, `${a.state} ${a.zip}`.trim()]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

type ProviderOutcome =
  | { kind: 'point'; lat: number; lng: number; approximate?: boolean }
  | { kind: 'no_match' }
  | { kind: 'error' };

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  const res = await fetchImpl(url, signal ? { signal } : undefined);
  const body = await res.json();
  // Mocked responses in tests may omit ok/status; treat missing as OK.
  const ok = res.ok === undefined ? true : res.ok;
  return { ok, status: res.status ?? 200, body };
}

async function googleGeocode(
  address: string,
  mapsKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<ProviderOutcome> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('components', 'country:US');
  url.searchParams.set('key', mapsKey);

  let data: {
    status?: string;
    error_message?: string;
    results?: Array<{
      geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
    }>;
  };
  try {
    data = (await fetchJson(url.toString(), fetchImpl, timeoutMs)).body as typeof data;
  } catch (err) {
    // Never log the URL: it carries the key and the address.
    console.error('Geocoding request failed', err instanceof Error ? err.name : 'unknown');
    return { kind: 'error' };
  }

  if (data?.status === 'ZERO_RESULTS') return { kind: 'no_match' };
  if (data?.status !== 'OK') {
    console.error('Geocoding status', {
      status: data?.status ?? 'missing',
      error_message: data?.error_message ?? null,
    });
    return { kind: 'error' };
  }
  const geom = data.results?.[0]?.geometry;
  const lat = geom?.location?.lat;
  const lng = geom?.location?.lng;
  if (!finite(lat) || !finite(lng)) return { kind: 'no_match' };
  return { kind: 'point', lat, lng, approximate: geom?.location_type === 'APPROXIMATE' };
}

async function censusGeocode(
  address: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<ProviderOutcome> {
  const url = new URL(CENSUS_GEOCODER_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', CENSUS_BENCHMARK);
  url.searchParams.set('format', 'json');

  let res: { ok: boolean; status: number; body: unknown };
  try {
    res = await fetchJson(url.toString(), fetchImpl, timeoutMs);
  } catch (err) {
    console.error('Census geocoder request failed', err instanceof Error ? err.name : 'unknown');
    return { kind: 'error' };
  }
  if (!res.ok) {
    console.error('Census geocoder HTTP status', res.status);
    return { kind: 'error' };
  }
  const body = res.body as {
    result?: { addressMatches?: Array<{ coordinates?: { x?: number; y?: number } }> };
  };
  const matches = body?.result?.addressMatches;
  if (!Array.isArray(matches)) {
    console.error('Census geocoder: unexpected response shape');
    return { kind: 'error' };
  }
  const c = matches[0]?.coordinates;
  // Census returns x = longitude, y = latitude.
  if (!c || !finite(c.x) || !finite(c.y)) return { kind: 'no_match' };
  return { kind: 'point', lat: c.y, lng: c.x };
}

export async function geocodeAddress(
  parts: AddressParts,
  opts: GeocodeOptions = {}
): Promise<GeocodeResult> {
  const address = oneLineAddress(parts);
  if (!address) return { ok: false, reason: 'no_match' };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? GEOCODE_TIMEOUT_MS;
  const mapsKey = opts.mapsKey === undefined ? googleMapsServerKey() : opts.mapsKey;

  let sawNoMatch = false;
  let approximate: GeocodePoint | null = null;

  if (mapsKey) {
    const g = await googleGeocode(address, mapsKey, fetchImpl, timeoutMs);
    if (g.kind === 'point' && !g.approximate) {
      return { ok: true, point: { lat: g.lat, lng: g.lng, source: 'google' } };
    }
    if (g.kind === 'point') approximate = { lat: g.lat, lng: g.lng, source: 'google_approximate' };
    if (g.kind === 'no_match') sawNoMatch = true;
  }

  const c = await censusGeocode(address, fetchImpl, timeoutMs);
  if (c.kind === 'point') {
    return { ok: true, point: { lat: c.lat, lng: c.lng, source: 'census' } };
  }
  if (c.kind === 'no_match') sawNoMatch = true;

  if (approximate) return { ok: true, point: approximate };
  return { ok: false, reason: sawNoMatch ? 'no_match' : 'unavailable' };
}
