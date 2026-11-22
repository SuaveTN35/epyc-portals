// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const JOB = '3f2b6c1e-8a4d-4f2a-9b7c-1d2e3f4a5b6c';

const state: {
  caller: { driver: { id: string; status: string; current_delivery_id: null } | null } | null;
  job: { id: string; driver_id: string; status: string } | null;
  inserted: Array<Record<string, unknown>>;
  driverUpdates: Array<Record<string, unknown>>;
} = { caller: null, job: null, inserted: [], driverUpdates: [] };

function admin() {
  return {
    from: (table: string) => {
      if (table === 'deliveries') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.job }) }) }) };
      }
      if (table === 'driver_locations') {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.inserted.push(row);
            return { error: null };
          },
        };
      }
      expect(table).toBe('drivers');
      return {
        update: (row: Record<string, unknown>) => ({
          eq: async () => {
            state.driverUpdates.push(row);
            return { error: null };
          },
        }),
      };
    },
  };
}

vi.mock('@/lib/server/driver-session', () => ({
  getCallerDriver: async () =>
    state.caller ? { userId: 'u1', driver: state.caller.driver, admin: admin() } : null,
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/driver/location', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let n = 0;
beforeEach(() => {
  n += 1;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  state.caller = { driver: { id: `drv-${n}`, status: 'active', current_delivery_id: null } };
  state.job = { id: JOB, driver_id: `drv-${n}`, status: 'picked_up' };
  state.inserted = [];
  state.driverUpdates = [];
});

describe('POST /api/driver/location', () => {
  it('saves a fix for the driver own active job', async () => {
    const res = await POST(req({ deliveryId: JOB, lat: 34.05, lng: -118.24, speed: 10 }));
    expect(await res.json()).toEqual({ ok: true });
    expect(state.inserted).toEqual([
      { driver_id: `drv-${n}`, delivery_id: JOB, lat: 34.05, lng: -118.24, speed: 10, heading: null },
    ]);
    expect(state.driverUpdates).toEqual([{ current_lat: 34.05, current_lng: -118.24 }]);
  });

  it('saves a late fix at its real time without moving the driver pin', async () => {
    const at = new Date(Date.now() - 5 * 60_000).toISOString();
    const res = await POST(req({ deliveryId: JOB, lat: 34.05, lng: -118.24, recordedAt: at }));
    expect(await res.json()).toEqual({ ok: true });
    expect(state.inserted[0].recorded_at).toBe(at);
    expect(state.driverUpdates).toEqual([]);
  });

  it('ignores a driver id in the body', async () => {
    await POST(req({ deliveryId: JOB, lat: 34.05, lng: -118.24, driver_id: 'someone-else' }));
    expect(state.inserted[0].driver_id).toBe(`drv-${n}`);
  });

  it('tells the phone to stop for another driver job or a finished job', async () => {
    state.job = { id: JOB, driver_id: 'other', status: 'picked_up' };
    expect(await (await POST(req({ deliveryId: JOB, lat: 34, lng: -118 }))).json()).toEqual({ ok: false, stop: true });
    state.job = { id: JOB, driver_id: `drv-${n}`, status: 'delivered' };
    expect(await (await POST(req({ deliveryId: JOB, lat: 34, lng: -118 }))).json()).toEqual({ ok: false, stop: true });
    expect(state.inserted).toEqual([]);
  });

  it('refuses no session, no driver account and a bad fix', async () => {
    state.caller = null;
    expect((await POST(req({ lat: 34, lng: -118 }))).status).toBe(401);
    state.caller = { driver: null };
    expect((await POST(req({ lat: 34, lng: -118 }))).status).toBe(403);
    state.caller = { driver: { id: `drv-${n}`, status: 'active', current_delivery_id: null } };
    expect((await POST(req({ lat: 200, lng: -118 }))).status).toBe(400);
    expect(state.inserted).toEqual([]);
  });

  it('answers 503 when the service key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await POST(req({ lat: 34, lng: -118 }))).status).toBe(503);
  });
});
