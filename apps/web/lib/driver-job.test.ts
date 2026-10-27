import { describe, it, expect } from 'vitest';
import {
  isBeforeReadyTime,
  isReleasable,
  parseReleaseRequest,
  releaseEventNote,
  validateException,
  exceptionEventNote,
  openExceptions,
  resolvedNote,
  parseMapApp,
  navUrl,
} from './driver-job';

describe('ready-time gate', () => {
  const start = '2026-11-11T16:00:00Z';
  it('blocks earlier than 15 minutes before the window', () => {
    expect(isBeforeReadyTime(start, new Date('2026-11-11T15:44:00Z'))).toBe(true);
  });
  it('allows from 15 minutes before', () => {
    expect(isBeforeReadyTime(start, new Date('2026-11-11T15:45:00Z'))).toBe(false);
    expect(isBeforeReadyTime(start, new Date('2026-11-11T17:00:00Z'))).toBe(false);
  });
  it('never blocks without a window', () => {
    expect(isBeforeReadyTime(null)).toBe(false);
    expect(isBeforeReadyTime('not a date')).toBe(false);
  });
});

describe('release', () => {
  it('only before pickup', () => {
    expect(isReleasable('assigned')).toBe(true);
    expect(isReleasable('arrived_pickup')).toBe(true);
    expect(isReleasable('picked_up')).toBe(false);
    expect(isReleasable('booked')).toBe(false);
  });
  it('requires a known reason and a note for other', () => {
    expect(parseReleaseRequest({ reason: 'too_heavy' })).toEqual({ ok: true, reason: 'too_heavy', note: '' });
    expect(parseReleaseRequest({ reason: 'nope' })).toMatchObject({ ok: false });
    expect(parseReleaseRequest({ reason: 'other', note: '' })).toMatchObject({ ok: false });
    expect(parseReleaseRequest({ reason: 'other', note: 'Family emergency' })).toMatchObject({ ok: true });
    expect(parseReleaseRequest(null)).toMatchObject({ ok: false });
  });
  it('writes a readable event note', () => {
    expect(releaseEventNote('vehicle_issue', 'Flat tire')).toBe(
      'Released by driver. Reason: Vehicle issue. Flat tire'
    );
  });
});

describe('exceptions', () => {
  it('validates reason and other-note', () => {
    expect(validateException('store_not_ready', '')).toBeNull();
    expect(validateException('other', '')).toMatch(/note/);
    expect(validateException('bogus', 'x')).toMatch(/Choose/);
  });
  it('formats the note', () => {
    expect(exceptionEventNote('store_not_ready', ' 20 min wait ')).toBe('Store not ready. 20 min wait');
  });
  it('tracks which exceptions are still open', () => {
    const events = [
      { id: 'e1', event_type: 'exception', notes: 'Store not ready', created_at: '2026-11-11T10:00:00Z' },
      { id: 'e2', event_type: 'exception', notes: 'Other. x', created_at: '2026-11-11T11:00:00Z' },
      { id: 'e3', event_type: 'exception_resolved', notes: resolvedNote('e1'), created_at: '2026-11-11T12:00:00Z' },
      { id: 'e4', event_type: 'status_change', notes: null, created_at: '2026-11-11T12:30:00Z' },
    ];
    expect(openExceptions(events).map((e) => e.id)).toEqual(['e2']);
  });
});

describe('navigation', () => {
  it('parses stored preference', () => {
    expect(parseMapApp('waze')).toBe('waze');
    expect(parseMapApp('bing')).toBeNull();
    expect(parseMapApp(null)).toBeNull();
  });
  it('prefers coordinates and falls back to the address', () => {
    expect(navUrl('google', '1 Main St', { lat: 1, lng: 2 })).toContain('destination=1,2');
    expect(navUrl('apple', '1 Main St', null)).toBe('https://maps.apple.com/?daddr=1%20Main%20St');
    expect(navUrl('waze', 'x', { lat: 3, lng: 4 })).toBe('https://waze.com/ul?ll=3,4&navigate=yes');
  });
});
