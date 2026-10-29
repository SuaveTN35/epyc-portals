// @vitest-environment node
// POST /api/documents/signed-url: staff only, known folders, plain paths only.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const state = { user: { id: 'u1' } as { id: string } | null, role: 'dispatcher', signed: [] as string[] };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: state.role } }) }) }) }),
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async (p: string) => {
          state.signed.push(p);
          return { data: { signedUrl: `https://signed/${p}` }, error: null };
        },
        createSignedUrls: async (ps: string[]) => {
          state.signed.push(...ps);
          return { data: ps.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })), error: null };
        },
      }),
    },
  }),
}));

const { POST } = await import('./route');

let ip = 0;
const req = (body: unknown) => {
  ip += 1;
  return new NextRequest('http://localhost/api/documents/signed-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.11.${ip % 250}.1` },
    body: JSON.stringify(body),
  });
};

beforeEach(() => {
  state.user = { id: 'u1' };
  state.role = 'dispatcher';
  state.signed = [];
});

describe('POST /api/documents/signed-url', () => {
  it('refuses non-staff', async () => {
    state.role = 'driver';
    expect((await POST(req({ path: 'insurance/x.jpg' }))).status).toBe(403);
    state.user = null;
    expect((await POST(req({ path: 'insurance/x.jpg' }))).status).toBe(401);
    expect(state.signed).toEqual([]);
  });

  it('signs a known document for staff', async () => {
    const res = await POST(req({ path: 'drivers/p1/vehicle_front-1.jpg' }));
    expect(res.status).toBe(200);
    expect(state.signed).toEqual(['drivers/p1/vehicle_front-1.jpg']);
  });

  it('refuses paths fetch would rewrite, single and batch (AEQUALIS QA)', async () => {
    const bad = [
      'drivers/P1/./vehicle_front-1.jpg',
      'drivers/P1/z/%2e%2e/vehicle_front-1.jpg',
      'drivers//vehicle_front-1.jpg',
      '/drivers/P1/vehicle_front-1.jpg',
      'drivers/P1/z/../vehicle_front-1.jpg',
      'drivers\\P1\\x.jpg',
    ];
    for (const p of bad) expect((await POST(req({ path: p }))).status, p).toBe(400);
    const res = await POST(req({ paths: [...bad, 'drivers/P1/registration-1.jpg'] }));
    expect(Object.keys((await res.json()).urls)).toEqual(['drivers/P1/registration-1.jpg']);
    expect(state.signed).toEqual(['drivers/P1/registration-1.jpg']);
  });
});
