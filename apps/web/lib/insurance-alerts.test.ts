import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { activeJobDriverIds, isActiveJobStatus, loadLapsedInsuranceDrivers } from './insurance-alerts';

// Minimal read-only client: from(table).select().in()/eq() resolves to the rows.
function fakeClient(tables: Record<string, unknown[]>, calls: string[] = []) {
  return {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        then: (res: (v: unknown) => unknown) => {
          calls.push(table);
          return Promise.resolve({ data: tables[table] || [], error: null }).then(res);
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

describe('isActiveJobStatus / activeJobDriverIds', () => {
  it('covers assigned through arrived at drop-off, not booked or finished', () => {
    for (const s of ['assigned', 'en_route_pickup', 'arrived_pickup', 'picked_up', 'en_route_delivery', 'arrived_delivery']) {
      expect(isActiveJobStatus(s)).toBe(true);
    }
    for (const s of ['booked', 'delivered', 'cancelled', 'failed', null]) expect(isActiveJobStatus(s)).toBe(false);
  });
  it('picks driver ids from active jobs only', () => {
    expect(
      activeJobDriverIds([
        { status: 'picked_up', driver_id: 'd1' },
        { status: 'delivered', driver_id: 'd2' },
        { status: 'assigned', driver_id: null },
        { status: 'booked', driver_id: 'd3' },
      ])
    ).toEqual(['d1']);
  });
});

describe('loadLapsedInsuranceDrivers', () => {
  it('returns drivers whose insurance expired or whose current card was rejected', async () => {
    const client = fakeClient({
      drivers: [
        { id: 'expired', insurance_card_url: 'c1', insurance_expiry: '2000-01-01' },
        { id: 'rejected', insurance_card_url: 'c2', insurance_expiry: '2099-01-01' },
        { id: 'fine', insurance_card_url: 'c3', insurance_expiry: '2099-01-01' },
      ],
      driver_review_items: [
        { driver_id: 'rejected', item: 'insurance_card', photo_path: 'c2', status: 'rejected', reason: 'x' },
        { driver_id: 'fine', item: 'insurance_card', photo_path: 'c3', status: 'approved', reason: null },
      ],
    });
    const out = await loadLapsedInsuranceDrivers(client, ['expired', 'rejected', 'fine']);
    expect([...out].sort()).toEqual(['expired', 'rejected']);
  });
  it('does not query when there are no drivers', async () => {
    const calls: string[] = [];
    expect((await loadLapsedInsuranceDrivers(fakeClient({}, calls), [])).size).toBe(0);
    expect(calls).toEqual([]);
  });
});
