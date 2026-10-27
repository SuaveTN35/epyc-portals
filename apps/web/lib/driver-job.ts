// Driver job-screen rules taken from the Dispatch driver app benchmark
// (reports/EPYC-DRIVER-APP-REFERENCE-SPEC-DISPATCH-BENCHMARK-2026-10-27.md,
// MVP rows only). Pure functions, unit tested in driver-job.test.ts.

export const EPYC_DISPATCH_PHONE_TEL = 'tel:+18182170070';
export const EPYC_DISPATCH_PHONE_DISPLAY = '(818) 217-0070';

// ---------------------------------------------------------------- ready time

/** Drivers may start this many minutes before the pickup window opens. */
export const READY_GRACE_MINUTES = 15;

/** True when it is still too early to start (UI gate only; not enforced in the DB). */
export function isBeforeReadyTime(
  pickupWindowStart: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!pickupWindowStart) return false;
  const start = new Date(pickupWindowStart).getTime();
  if (Number.isNaN(start)) return false;
  return now.getTime() < start - READY_GRACE_MINUTES * 60_000;
}

export function readyTimeLabel(pickupWindowStart: string): string {
  const d = new Date(pickupWindowStart);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------- release

export const RELEASE_REASONS = [
  { value: 'vehicle_issue', label: 'Vehicle issue' },
  { value: 'cannot_make_window', label: "Can't make the window" },
  { value: 'too_heavy', label: 'Too heavy' },
  { value: 'other', label: 'Other' },
] as const;

export type ReleaseReason = (typeof RELEASE_REASONS)[number]['value'];

/** A driver may give a job back only before pickup. */
export const RELEASABLE_STATUSES = ['assigned', 'en_route_pickup', 'arrived_pickup'] as const;

export function isReleasable(status: string): boolean {
  return (RELEASABLE_STATUSES as readonly string[]).includes(status);
}

export function parseReleaseRequest(
  body: unknown
): { ok: true; reason: ReleaseReason; note: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request' };
  const { reason, note } = body as { reason?: unknown; note?: unknown };
  const match = RELEASE_REASONS.find((r) => r.value === reason);
  if (!match) return { ok: false, error: 'Choose a reason' };
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  if (match.value === 'other' && cleanNote.length < 3) {
    return { ok: false, error: 'Add a short note for Other' };
  }
  return { ok: true, reason: match.value, note: cleanNote };
}

export function releaseEventNote(reason: ReleaseReason, note: string): string {
  const label = RELEASE_REASONS.find((r) => r.value === reason)?.label ?? reason;
  return note ? `Released by driver. Reason: ${label}. ${note}` : `Released by driver. Reason: ${label}.`;
}

// ---------------------------------------------------------------- exceptions

export const EXCEPTION_REASONS = [
  { value: 'cannot_get_in', label: "Can't get in / closed" },
  { value: 'recipient_not_there', label: 'Customer or recipient not there' },
  { value: 'store_not_ready', label: 'Store not ready' },
  { value: 'wrong_or_damaged', label: 'Wrong or damaged item' },
  { value: 'vehicle_issue', label: 'Vehicle issue' },
  { value: 'other', label: 'Other' },
] as const;

export type ExceptionReason = (typeof EXCEPTION_REASONS)[number]['value'];

export function validateException(reason: string, note: string): string | null {
  if (!EXCEPTION_REASONS.some((r) => r.value === reason)) return 'Choose what the problem is.';
  if (reason === 'other' && note.trim().length < 3) return 'Add a short note for Other.';
  return null;
}

export function exceptionEventNote(reason: ExceptionReason, note: string): string {
  const label = EXCEPTION_REASONS.find((r) => r.value === reason)?.label ?? reason;
  const n = note.trim();
  return n ? `${label}. ${n}` : label;
}

/** Notes text on an exception_resolved event; links it to the exception. */
export function resolvedNote(exceptionEventId: string): string {
  return `Resolved exception ${exceptionEventId}`;
}

export interface EventLike {
  id: string;
  delivery_id?: string;
  event_type: string;
  notes: string | null;
  created_at: string;
}

/** Exception events with no matching exception_resolved event, newest first. */
export function openExceptions<T extends EventLike>(events: T[]): T[] {
  const resolved = new Set(
    events
      .filter((e) => e.event_type === 'exception_resolved' && e.notes)
      .map((e) => (e.notes as string).replace(/^Resolved exception\s+/, '').trim())
  );
  return events
    .filter((e) => e.event_type === 'exception' && !resolved.has(e.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------------------------------------------------------------- navigation

export type MapApp = 'google' | 'apple' | 'waze';
export const MAP_APPS: { id: MapApp; name: string }[] = [
  { id: 'google', name: 'Google Maps' },
  { id: 'apple', name: 'Apple Maps' },
  { id: 'waze', name: 'Waze' },
];
export const MAP_APP_STORAGE_KEY = 'epyc.driver.mapApp';

export function parseMapApp(value: string | null | undefined): MapApp | null {
  return value === 'google' || value === 'apple' || value === 'waze' ? value : null;
}

export function navUrl(
  app: MapApp,
  address: string,
  coords: { lat: number; lng: number } | null
): string {
  const q = encodeURIComponent(address);
  switch (app) {
    case 'google':
      return coords
        ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    case 'apple':
      return coords
        ? `https://maps.apple.com/?daddr=${coords.lat},${coords.lng}`
        : `https://maps.apple.com/?daddr=${q}`;
    case 'waze':
      return coords
        ? `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
        : `https://waze.com/ul?q=${q}&navigate=yes`;
  }
}

// ---------------------------------------------------------------- tags and order

export const HEAVY_ITEM_LBS = 150;

export function jobTags(d: {
  package_weight?: number | null;
  loading_required?: boolean | null;
}): string[] {
  const tags: string[] = [];
  if (d.package_weight != null && Number(d.package_weight) > HEAVY_ITEM_LBS) tags.push('Heavy item');
  if (d.loading_required) tags.push('Loading required');
  return tags;
}

/** "24 x 18 x 12 in", or null when no dimension is set. */
export function dimensionsLabel(
  l: number | null | undefined,
  w: number | null | undefined,
  h: number | null | undefined
): string | null {
  if (l == null && w == null && h == null) return null;
  const v = (n: number | null | undefined) => (n == null ? '?' : String(Number(n)));
  return `${v(l)} x ${v(w)} x ${v(h)} in`;
}
