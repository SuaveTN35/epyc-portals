// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const JOB = '3f2b6c1e-8a4d-4f2a-9b7c-1d2e3f4a5b6c';

const state: {
  user: { id: string } | null;
  job: Record<string, unknown> | null;
  loc: Record<string, unknown> | null;
} = { user: null, job: null, loc: null };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));

vi.mock('@/lib/server/driver-session', () => ({
  createServiceClient: () => ({
    from: (table: string) =>
      table === 'deliveries'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.job }) }) }) }
        : {
            select: () => ({
              eq: () => ({ order: () => ({ limit: async () => ({ data: state.loc ? [state.loc] : [] }) }) }),
            }),
          },
  }),
}));

import { GET } from './route';

let ip = 0;
async function call() {
  ip += 1;
  const res = await GET(
    new NextRequest(`http://localhost/api/client/deliveries/${JOB}/live`, { headers: { 'x-forwarded-for': `10.1.0.${ip}` } }),
    { params: Promise.resolve({ id: JOB }) }
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  state.user = { id: 'cust-1' };
  state.job = {
    id: JOB,
    customer_id: 'cust-1',
    status: 'picked_up',
    driver_id: 'drv-1',
    updated_at: '2026-11-20T20:00:00Z',
    pickup_lat: '34.05',
    pickup_lng: '-118.24',
    delivery_lat: 34.01,
    delivery_lng: -118.49,
  };
  state.loc = { lat: '34.03', lng: '-118.3', recorded_at: new Date().toISOString(), delivery_id: JOB };
});

describe('GET /api/client/deliveries/:id/live', () => {
  it('gives the owner the status and a fresh driver position', async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.status).toBe('picked_up');
    expect(body.driver).toMatchObject({ lat: 34.03, lng: -118.3 });
    expect(body.pickup).toEqual({ lat: 34.05, lng: -118.24 });
    expect(body.dropoff).toEqual({ lat: 34.01, lng: -118.49 });
  });

  it('hides another customer job', async () => {
    state.job = { ...state.job, customer_id: 'someone-else' };
    expect((await call()).status).toBe(404);
  });

  it('hides a stale fix, a fix for another job, and any fix once delivered', async () => {
    state.loc = { ...state.loc, recorded_at: '2020-01-01T00:00:00Z' };
    expect((await call()).body.driver).toBe(null);
    state.loc = { lat: 1, lng: 1, recorded_at: new Date().toISOString(), delivery_id: '00000000-0000-4000-8000-000000000000' };
    expect((await call()).body.driver).toBe(null);
    state.loc = { lat: 1, lng: 1, recorded_at: new Date().toISOString(), delivery_id: JOB };
    state.job = { ...state.job, status: 'delivered' };
    expect((await call()).body.driver).toBe(null);
  });

  it('needs a session and the service key', async () => {
    state.user = null;
    expect((await call()).status).toBe(401);
    state.user = { id: 'cust-1' };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await call()).status).toBe(503);
  });
});
