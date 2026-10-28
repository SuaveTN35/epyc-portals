// Server-side route distance. Used by /api/distance and by the customer
// booking route (/api/client/deliveries), which prices from this number and
// never from a distance the browser sends. Google Distance Matrix when a key
// is configured, haversine x 1.3 otherwise or when Google fails.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteDistance {
  distance_miles: number;
  duration_minutes: number;
  distance_text: string;
  duration_text: string;
  source: 'google' | 'haversine' | 'haversine_fallback';
}

export class RouteNotFoundError extends Error {
  constructor() {
    super('Unable to calculate distance between locations');
    this.name = 'RouteNotFoundError';
  }
}

/** Great-circle (straight-line) miles between two points. */
export function straightLineMiles(a: LatLng, b: LatLng): number {
  const R = 3959; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

/** Straight-line miles x 1.3 to approximate driving distance. */
export function haversineDrivingMiles(a: LatLng, b: LatLng): number {
  return straightLineMiles(a, b) * 1.3;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
}

function haversineResult(
  origin: LatLng,
  destination: LatLng,
  source: 'haversine' | 'haversine_fallback'
): RouteDistance {
  const miles = Math.round(haversineDrivingMiles(origin, destination) * 10) / 10;
  // Average 25 mph in LA traffic.
  const minutes = Math.round((miles / 25) * 60);
  return {
    distance_miles: miles,
    duration_minutes: minutes,
    distance_text: `${miles} mi`,
    duration_text: formatDuration(minutes),
    source,
  };
}

/** Server key first; the public browser key is the legacy fallback. */
export function googleMapsServerKey(): string | undefined {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

export interface DistanceOptions {
  /** Pass null to force haversine (tests). Omit to read the environment. */
  mapsKey?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export const DISTANCE_TIMEOUT_MS = 4000;

/**
 * Route distance between two points. Throws RouteNotFoundError when Google
 * answers but has no driving route (for example across water). Network or
 * quota failures fall back to haversine so booking keeps working.
 */
export async function computeRouteDistance(
  origin: LatLng,
  destination: LatLng,
  opts: DistanceOptions = {}
): Promise<RouteDistance> {
  const mapsKey = opts.mapsKey === undefined ? googleMapsServerKey() : opts.mapsKey;
  if (!mapsKey) return haversineResult(origin, destination, 'haversine');

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destinations', `${destination.lat},${destination.lng}`);
  url.searchParams.set('units', 'imperial');
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('departure_time', 'now');
  url.searchParams.set('traffic_model', 'best_guess');
  url.searchParams.set('key', mapsKey);

  let data: {
    status?: string;
    error_message?: string;
    rows?: Array<{
      elements?: Array<{
        status?: string;
        distance?: { value: number; text: string };
        duration?: { value: number; text: string };
        duration_in_traffic?: { value: number; text: string };
      }>;
    }>;
  };
  try {
    const timeoutMs = opts.timeoutMs ?? DISTANCE_TIMEOUT_MS;
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined;
    const res = await (opts.fetchImpl ?? fetch)(url.toString(), signal ? { signal } : undefined);
    data = await res.json();
  } catch (err) {
    // Error name only: some fetch errors echo the request URL, which carries the key.
    console.error('Distance Matrix request failed', err instanceof Error ? err.name : 'unknown');
    return haversineResult(origin, destination, 'haversine_fallback');
  }

  if (data?.status !== 'OK') {
    // Never log the request URL: it carries the key.
    // error_message says why (API not enabled, billing, referrer-restricted key).
    console.error('Distance Matrix status', {
      status: data?.status ?? 'missing',
      error_message: data?.error_message ?? null,
    });
    return haversineResult(origin, destination, 'haversine_fallback');
  }

  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== 'OK' || !el.distance || !el.duration) {
    throw new RouteNotFoundError();
  }

  const miles = el.distance.value / 1609.344;
  const seconds = el.duration_in_traffic?.value || el.duration.value;
  return {
    distance_miles: Math.round(miles * 10) / 10,
    duration_minutes: Math.round(seconds / 60),
    distance_text: el.distance.text,
    duration_text: el.duration_in_traffic?.text || el.duration.text,
    source: 'google',
  };
}
