// Pure rules for live driver location (GPS while a job is active).
// The driver's phone sends fixes to POST /api/driver/location; the customer's
// delivery page reads the latest one from GET /api/client/deliveries/:id/live;
// dispatch's live map shows the latest fix per driver. No network here.

/** Job statuses during which the driver's phone shares its location. */
export const LIVE_TRACKING_STATUSES = [
  'assigned',
  'en_route_pickup',
  'arrived_pickup',
  'picked_up',
  'en_route_delivery',
  'arrived_delivery',
] as const;

export function isLiveTrackingStatus(status: string | null | undefined): boolean {
  return (LIVE_TRACKING_STATUSES as readonly string[]).includes(status ?? '');
}

/** Send at most this often, even when moving fast. */
export const MIN_SEND_INTERVAL_MS = 10_000;
/** Send at least this often while the phone gets fixes, even when parked. */
export const MAX_SEND_INTERVAL_MS = 60_000;
/** Movement that counts as a new position. */
export const MIN_MOVE_METERS = 25;
/** A customer sees the driver's position only if it is this recent. */
export const CUSTOMER_LOCATION_MAX_AGE_MS = 15 * 60_000;
/** Fixes worse than this are dropped (Wi-Fi or cell-tower guesses). */
export const MAX_ACCURACY_METERS = 500;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Should the phone send this fix, given the last one it sent? */
export function shouldSendLocation(
  last: (LatLng & { atMs: number }) | null,
  next: LatLng,
  nowMs: number
): boolean {
  if (!last) return true;
  const elapsed = nowMs - last.atMs;
  if (elapsed < MIN_SEND_INTERVAL_MS) return false;
  if (elapsed >= MAX_SEND_INTERVAL_MS) return true;
  return distanceMeters(last, next) >= MIN_MOVE_METERS;
}

export interface LocationFix {
  deliveryId: string | null;
  lat: number;
  lng: number;
  /** meters per second, or null */
  speed: number | null;
  /** degrees 0-359, or null */
  heading: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validate the body the driver's phone sends. Never trusts a driver id from the body. */
export function parseLocationBody(
  body: unknown
): { ok: true; value: LocationFix } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing location' };
  const b = body as Record<string, unknown>;
  const { lat, lng } = b;
  if (!finite(lat) || !finite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, error: 'Invalid location' };
  }
  if (lat === 0 && lng === 0) return { ok: false, error: 'Invalid location' };
  if (finite(b.accuracy) && b.accuracy > MAX_ACCURACY_METERS) {
    return { ok: false, error: 'Location too rough' };
  }
  let deliveryId: string | null = null;
  if (b.deliveryId !== undefined && b.deliveryId !== null) {
    if (typeof b.deliveryId !== 'string' || !UUID_RE.test(b.deliveryId)) {
      return { ok: false, error: 'Invalid job' };
    }
    deliveryId = b.deliveryId.toLowerCase();
  }
  // speed is DECIMAL(5,2) in the table: clamp to what fits.
  const speed = finite(b.speed) && b.speed >= 0 ? Math.min(Math.round(b.speed * 100) / 100, 999.99) : null;
  const heading = finite(b.heading) && b.heading >= 0 ? Math.round(b.heading) % 360 : null;
  return {
    ok: true,
    value: { deliveryId, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, speed, heading },
  };
}

/** True when a recorded_at timestamp is within maxAgeMs of now. */
export function isLocationFresh(
  recordedAt: string | null | undefined,
  nowMs: number,
  maxAgeMs = CUSTOMER_LOCATION_MAX_AGE_MS
): boolean {
  if (!recordedAt) return false;
  const t = Date.parse(recordedAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t <= maxAgeMs && t - nowMs <= 60_000;
}

/** "just now", "1 min ago", "12 min ago", "2 hr ago". */
export function locationAgeLabel(recordedAt: string | null | undefined, nowMs: number): string {
  if (!recordedAt) return 'not yet';
  const t = Date.parse(recordedAt);
  if (Number.isNaN(t)) return 'not yet';
  const s = Math.max(0, Math.round((nowMs - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} hr ago`;
}

export interface LocationRow {
  driver_id: string;
  recorded_at: string | null;
}

/** Keep only the newest row per driver (dispatch live map). */
export function latestPerDriver<T extends LocationRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const cur = best.get(r.driver_id);
    if (!cur || Date.parse(r.recorded_at ?? '') > Date.parse(cur.recorded_at ?? '')) best.set(r.driver_id, r);
  }
  return [...best.values()];
}

/** Google Maps link for one point (used when the map itself cannot load). */
export function mapsLink(p: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

/** Days of driver location history kept (the privacy policy promises 90). */
export const LOCATION_RETENTION_DAYS = 90;

/** ISO time before which location rows are deleted by the daily purge. */
export function retentionCutoff(nowMs: number, days = LOCATION_RETENTION_DAYS): string {
  return new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
}
