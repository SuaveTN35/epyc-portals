// @vitest-environment node
// GET /api/documents/view: staff-only, path rule, type sniffing, HEIC to
// JPEG. Supabase storage and the staff session are mocked; the route, the
// sniffer, and the real HEIC converter run.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const state = {
  staff: true,
  file: null as Uint8Array | null,
  downloaded: [] as string[],
};

vi.mock('@/lib/server/staff-session', () => ({
  getCallerStaff: async () =>
    state.staff
      ? {
          userId: 'staff-1',
          admin: {
            storage: {
              from: () => ({
                download: async (p: string) => {
                  state.downloaded.push(p);
                  return state.file ? { data: new Blob([state.file]), error: null } : { data: null, error: { message: 'not found' } };
                },
              }),
            },
          },
        }
      : null,
}));

const { GET } = await import('./route');

let ip = 0;
function req(path: string | null) {
  ip += 1;
  const q = path === null ? '' : `?path=${encodeURIComponent(path)}`;
  return new NextRequest(`http://localhost/api/documents/view${q}`, { headers: { 'x-forwarded-for': `10.9.${ip % 250}.1` } });
}
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new TextEncoder().encode('%PDF-1.4 test');
const HEIC = new Uint8Array(readFileSync(join(__dirname, '../../../../lib/__fixtures__/sample.heic')));

beforeEach(() => {
  state.staff = true;
  state.file = JPEG;
  state.downloaded = [];
});

describe('GET /api/documents/view', () => {
  it('refuses anyone who is not staff, before touching storage', async () => {
    state.staff = false;
    const res = await GET(req('drivers/p1/vehicle_front-1.jpg'));
    expect(res.status).toBe(403);
    expect(state.downloaded).toEqual([]);
  });

  it('refuses paths outside the known folders or with ..', async () => {
    for (const p of [null, '', 'secrets/x.jpg', 'drivers/../../x', '/drivers/p1/x.jpg', 'https://evil.example/x.jpg']) {
      const res = await GET(req(p));
      expect(res.status).toBe(400);
    }
    expect(state.downloaded).toEqual([]);
  });

  it('shows a JPEG inline with a sandbox CSP', async () => {
    const res = await GET(req('license-front/123-abc.jpg'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(res.headers.get('content-security-policy')).toMatch(/sandbox/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
  });

  it('shows a PDF inline (no sandbox, so the browser PDF viewer works)', async () => {
    state.file = PDF;
    const res = await GET(req('drivers/p1/insurance_card-1.pdf'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('types by content, not by name: HTML named .jpg is refused', async () => {
    state.file = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    const res = await GET(req('vehicles/1-x.jpg'));
    expect(res.status).toBe(415);
  });

  it('converts an iPhone HEIC to JPEG', async () => {
    state.file = HEIC;
    const res = await GET(req('vehicles/1-x.heic'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('content-disposition')).toMatch(/filename="1-x\.jpg"/);
    const out = new Uint8Array(await res.arrayBuffer());
    expect([out[0], out[1], out[2]]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('answers 422 for a HEIC that cannot be converted', async () => {
    state.file = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypheic'), 0, 0, 0, 0, 9, 9, 9]);
    const res = await GET(req('vehicles/1-bad.heic'));
    expect(res.status).toBe(422);
  });

  it('answers 404 when the file is not in storage', async () => {
    state.file = null;
    const res = await GET(req('drivers/p1/gone.jpg'));
    expect(res.status).toBe(404);
  });
});
