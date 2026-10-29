// @vitest-environment node
// P-366 API and authorization paths: driver upload / details / signed URLs,
// dispatch review, and the insurance block on offer accept. Supabase is
// replaced by a small recording mock; route logic and lib rules are real.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { pacificToday } from '@/lib/driver-profile';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oversizeHeic } from '@/lib/__fixtures__/heic-fixtures';

type Op = [string, ...unknown[]];
type Handler = (table: string, ops: Op[], terminal: string) => { data: unknown; error: unknown };

class Q {
  ops: Op[] = [];
  constructor(private table: string, private h: Handler, private log: Array<{ table: string; ops: Op[] }>) {
    log.push({ table, ops: this.ops });
  }
  private add(name: string, ...a: unknown[]) {
    this.ops.push([name, ...a]);
    return this;
  }
  select(...a: unknown[]) { return this.add('select', ...a); }
  eq(...a: unknown[]) { return this.add('eq', ...a); }
  in(...a: unknown[]) { return this.add('in', ...a); }
  is(...a: unknown[]) { return this.add('is', ...a); }
  neq(...a: unknown[]) { return this.add('neq', ...a); }
  gt(...a: unknown[]) { return this.add('gt', ...a); }
  order(...a: unknown[]) { return this.add('order', ...a); }
  update(...a: unknown[]) { return this.add('update', ...a); }
  insert(...a: unknown[]) { return this.add('insert', ...a); }
  upsert(...a: unknown[]) { return this.add('upsert', ...a); }
  maybeSingle() { return Promise.resolve(this.h(this.table, this.ops, 'maybeSingle')); }
  single() { return Promise.resolve(this.h(this.table, this.ops, 'single')); }
  then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
    return Promise.resolve(this.h(this.table, this.ops, 'await')).then(res, rej);
  }
}

const state = {
  user: { id: 'prof-1' } as { id: string } | null,
  sessionLog: [] as Array<{ table: string; ops: Op[] }>,
  adminLog: [] as Array<{ table: string; ops: Op[] }>,
  uploads: [] as string[],
  signed: [] as string[],
  sessionHandler: (() => ({ data: null, error: null })) as Handler,
  adminHandler: (() => ({ data: null, error: null })) as Handler,
  staff: null as { userId: string } | null,
  callerDriver: null as { id: string; status: string; current_delivery_id: null } | null,
};

function adminClient() {
  return {
    from: (t: string) => new Q(t, state.adminHandler, state.adminLog),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          state.uploads.push(path);
          return { error: null };
        },
        createSignedUrls: async (paths: string[]) => {
          state.signed.push(...paths);
          return { data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })), error: null };
        },
      }),
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (t: string) => new Q(t, state.sessionHandler, state.sessionLog),
  }),
}));
vi.mock('@/lib/server/driver-session', () => ({
  createServiceClient: () => adminClient(),
  getCallerDriver: async () =>
    state.user ? { userId: state.user.id, driver: state.callerDriver, admin: adminClient() } : null,
}));
vi.mock('@/lib/server/staff-session', () => ({
  getCallerStaff: async () => (state.staff ? { userId: state.staff.userId, admin: adminClient() } : null),
}));

import { POST as upload } from './upload/route';
import { POST as details } from './details/route';
import { POST as signedUrls } from './signed-urls/route';
import { POST as gearRoute } from './gear/route';
import { GET as offersList } from '../offers/route';
import { POST as review } from '../../dispatch/drivers/[id]/review/route';
import { POST as respond } from '../offers/[id]/respond/route';

let ip = 0;
function jsonReq(url: string, body: unknown) {
  ip += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${Math.floor(ip / 250)}.${ip % 250}` },
    body: JSON.stringify(body),
  });
}
function formReq(fields: Record<string, string | Blob>) {
  ip += 1;
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest('http://localhost/api/driver/profile/upload', {
    method: 'POST',
    headers: { 'x-forwarded-for': `10.8.${Math.floor(ip / 250)}.${ip % 250}` },
    body: fd,
  });
}
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: 'image/jpeg' });
const pdf = () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  state.user = { id: 'prof-1' };
  state.sessionLog = [];
  state.adminLog = [];
  state.uploads = [];
  state.signed = [];
  state.staff = null;
  state.callerDriver = null;
  state.sessionHandler = () => ({ data: null, error: null });
  state.adminHandler = () => ({ data: null, error: null });
});

const opsOf = (log: Array<{ table: string; ops: Op[] }>, table: string, op: string) =>
  log.filter((l) => l.table === table).flatMap((l) => l.ops.filter((o) => o[0] === op));

describe('POST /api/driver/profile/upload', () => {
  it('requires a session', async () => {
    state.user = null;
    const res = await upload(formReq({ item: 'gloves', file: jpeg() }));
    expect(res.status).toBe(401);
    expect(state.uploads).toEqual([]);
  });

  it('refuses unknown items, data items, and PDFs for photo-only items', async () => {
    expect((await upload(formReq({ item: 'license', file: jpeg() }))).status).toBe(400);
    expect((await upload(formReq({ item: 'cargo_dimensions', file: jpeg() }))).status).toBe(400);
    expect((await upload(formReq({ item: 'gloves', file: pdf() }))).status).toBe(400);
    expect(state.uploads).toEqual([]);
  });

  it('stores under the session user folder only, and returns the path (onboarding)', async () => {
    const res = await upload(formReq({ item: 'insurance_card', file: pdf(), path: 'drivers/someone-else' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toMatch(/^drivers\/prof-1\/insurance_card-\d+-[a-z0-9]+\.pdf$/);
    expect(state.uploads).toEqual([body.path]);
    expect(state.sessionLog).toEqual([]); // nothing recorded without record=1
  });

  it('record=1 equipment: upserts the review row with the SESSION client (DB guards apply)', async () => {
    state.sessionHandler = (t, _ops, term) =>
      t === 'drivers' && term === 'maybeSingle' ? { data: { id: 'drv-1' }, error: null } : { data: null, error: null };
    const res = await upload(formReq({ item: 'hand_truck', file: jpeg(), record: '1' }));
    expect(res.status).toBe(200);
    const [up] = opsOf(state.sessionLog, 'driver_review_items', 'upsert');
    expect(up[1]).toMatchObject({ driver_id: 'drv-1', item: 'hand_truck' });
    expect((up[1] as { status?: string }).status).toBeUndefined(); // status is set by the DB guard, not the route
    expect(up[1]).toMatchObject({ owned: true }); // a gear photo also declares the gear
    expect(opsOf(state.adminLog, 'driver_review_items', 'upsert')).toEqual([]);
  });

  it('record=1 insurance card: updates drivers.insurance_card_url with the session client', async () => {
    state.sessionHandler = (t, _ops, term) =>
      t === 'drivers' && term === 'maybeSingle' ? { data: { id: 'drv-1' }, error: null } : { data: null, error: null };
    const res = await upload(formReq({ item: 'insurance_card', file: jpeg(), record: '1' }));
    const body = await res.json();
    const [upd] = opsOf(state.sessionLog, 'drivers', 'update');
    expect(upd[1]).toEqual({ insurance_card_url: body.path });
  });
});

describe('upload: HEIC and ID badge timing', () => {
  it('converts a real HEIC to JPEG on the server and stores it as .jpg', async () => {
    const real = readFileSync(join(__dirname, '../../../../lib/__fixtures__/sample.heic'));
    const heic = new Blob([new Uint8Array(real)], { type: 'image/heic' });
    const res = await upload(formReq({ item: 'vehicle_front', file: heic }));
    expect(res.status).toBe(200);
    const { path } = await res.json();
    expect(path).toMatch(/^drivers\/prof-1\/vehicle_front-.*\.jpg$/);
    expect(state.uploads).toContain(path);
  });

  it('types the upload by its bytes: HTML claimed as a JPEG is refused', async () => {
    const fake = new Blob([new TextEncoder().encode('<html>x</html>')], { type: 'image/jpeg' });
    expect((await upload(formReq({ item: 'vehicle_front', file: fake }))).status).toBe(400);
  });

  it('refuses a HEIC that declares more than the pixel cap, before decoding', async () => {
    const big = new Blob([new Uint8Array(oversizeHeic())], { type: 'image/heic' });
    const res = await upload(formReq({ item: 'vehicle_front', file: big }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/HEIC/);
    expect(state.uploads).toEqual([]);
  });

  it('refuses a HEIC that cannot be converted either, with a clear message (QA N4)', async () => {
    const heic = new Blob([new Uint8Array([0, 0, 0, 24])], { type: 'image/heic' });
    const res = await upload(formReq({ item: 'vehicle_front', file: heic }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/HEIC/);
    expect(state.uploads).toEqual([]);
  });

  it('refuses the ID badge photo before approval, allows it once active (TRIBUNAL R1)', async () => {
    state.sessionHandler = (t, _ops, term) =>
      t === 'drivers' && term === 'maybeSingle' ? { data: { id: 'drv-1', status: 'pending' }, error: null } : { data: null, error: null };
    let res = await upload(formReq({ item: 'id_badge_photo', file: jpeg(), record: '1' }));
    expect(res.status).toBe(403);
    res = await upload(formReq({ item: 'id_badge_photo', file: jpeg() })); // onboarding path, no record
    expect(res.status).toBe(403);
    expect(state.uploads).toEqual([]);
    state.sessionHandler = (t, _ops, term) =>
      t === 'drivers' && term === 'maybeSingle' ? { data: { id: 'drv-1', status: 'active' }, error: null } : { data: null, error: null };
    res = await upload(formReq({ item: 'id_badge_photo', file: jpeg(), record: '1' }));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/driver/profile/gear (declared gear, R12)', () => {
  it('declares or un-declares own gear with the session client', async () => {
    state.sessionHandler = (t, _ops, term) =>
      t === 'drivers' && term === 'maybeSingle' ? { data: { id: 'drv-1' }, error: null } : { data: null, error: null };
    const res = await gearRoute(jsonReq('/api/driver/profile/gear', { item: 'boots', owned: false }));
    expect(res.status).toBe(200);
    const [up] = opsOf(state.sessionLog, 'driver_review_items', 'upsert');
    expect(up[1]).toEqual({ driver_id: 'drv-1', item: 'boots', owned: false });
  });
  it('refuses non-gear items and bad bodies', async () => {
    expect((await gearRoute(jsonReq('/x', { item: 'insurance_card', owned: true }))).status).toBe(400);
    expect((await gearRoute(jsonReq('/x', { item: 'boots', owned: 'yes' }))).status).toBe(400);
    state.user = null;
    expect((await gearRoute(jsonReq('/x', { item: 'boots', owned: true }))).status).toBe(401);
  });
});

describe('POST /api/driver/profile/details', () => {
  it('rejects out-of-bounds dimensions before touching the database', async () => {
    const res = await details(jsonReq('/api/driver/profile/details', {
      section: 'dimensions', cargo_length_in: 9999, cargo_width_in: 60, cargo_height_in: 40, cargo_capacity_lbs: 500,
    }));
    expect(res.status).toBe(400);
    expect(state.sessionLog).toEqual([]);
  });

  it('saves validated insurance details as the driver (session client), scoped to their own row', async () => {
    state.sessionHandler = () => ({ data: [{ id: 'drv-1' }], error: null });
    const res = await details(jsonReq('/api/driver/profile/details', {
      section: 'insurance',
      insurance_carrier: 'Acme',
      insurance_policy: 'P1',
      insurance_expiry: '2099-01-01',
      insurance_bi_per_person: '30,000',
      insurance_bi_per_accident: 60000,
      insurance_pd_limit: 15000,
      insurance_business_use: true,
      // A driver cannot smuggle protected fields through this route.
      status: 'active',
    }));
    expect(res.status).toBe(200);
    const [upd] = opsOf(state.sessionLog, 'drivers', 'update');
    expect(upd[1]).toEqual({
      insurance_carrier: 'Acme', insurance_policy: 'P1', insurance_expiry: '2099-01-01',
      insurance_bi_per_person: 30000, insurance_bi_per_accident: 60000, insurance_pd_limit: 15000,
      insurance_business_use: true,
    });
    expect(opsOf(state.sessionLog, 'drivers', 'eq')).toContainEqual(['eq', 'profile_id', 'prof-1']);
  });

  it('rejects an expired insurance date and an unknown section', async () => {
    expect((await details(jsonReq('/api/driver/profile/details', { section: 'registration', registration_expiry: '2000-01-01' }))).status).toBe(400);
    expect((await details(jsonReq('/api/driver/profile/details', { section: 'status', status: 'active' }))).status).toBe(400);
  });

  it('requires a session', async () => {
    state.user = null;
    const res = await details(jsonReq('/api/driver/profile/details', { section: 'registration', registration_expiry: '2099-01-01' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/driver/profile/signed-urls', () => {
  it('signs only own-folder paths or files on the caller record', async () => {
    state.adminHandler = (t, _ops, term) => {
      if (t === 'drivers' && term === 'maybeSingle') return { data: { id: 'drv-1', insurance_card_url: 'insurance/legacy.jpg' }, error: null };
      if (t === 'driver_review_items') return { data: [{ photo_path: 'drivers/prof-1/gloves.jpg' }], error: null };
      return { data: null, error: null };
    };
    const res = await signedUrls(jsonReq('/api/driver/profile/signed-urls', {
      paths: ['drivers/prof-1/a.jpg', 'insurance/legacy.jpg', 'insurance/someone-else.jpg', 'drivers/prof-2/x.jpg', 'drivers/prof-1/../prof-2/x.jpg'],
    }));
    expect(res.status).toBe(200);
    expect(state.signed.sort()).toEqual(['drivers/prof-1/a.jpg', 'insurance/legacy.jpg']);
  });

  it('never signs a path fetch would rewrite (AEQUALIS QA dot-segment cases)', async () => {
    state.adminHandler = (t, _ops, term) => {
      if (t === 'drivers' && term === 'maybeSingle') return { data: { id: 'drv-1' }, error: null };
      if (t === 'driver_review_items') return { data: [], error: null };
      return { data: null, error: null };
    };
    const res = await signedUrls(jsonReq('/api/driver/profile/signed-urls', {
      paths: ['drivers/prof-1/./x.jpg', 'drivers/prof-1/z/%2e%2e/x.jpg', 'drivers/prof-1//x.jpg', '/drivers/prof-1/x.jpg', 'drivers/prof-1/ok.jpg'],
    }));
    expect(res.status).toBe(200);
    expect(state.signed).toEqual(['drivers/prof-1/ok.jpg']);
  });
});

describe('POST /api/dispatch/drivers/:id/review', () => {
  const driverRow = {
    id: 'drv-1',
    insurance_card_url: 'insurance/legacy.jpg',
    registration_url: null,
    vehicle_photo_front_url: null, vehicle_photo_back_url: null, vehicle_photo_side_url: null, vehicle_photo_cargo_url: null,
    cargo_length_in: null, cargo_width_in: null, cargo_height_in: null, cargo_capacity_lbs: null,
  };

  it('refuses non-staff callers', async () => {
    const res = await review(jsonReq('/x', { item: 'gloves', decision: 'approve', uploaded_at: null }), ctx('drv-1'));
    expect(res.status).toBe(403);
  });

  it('refuses a rejection without a reason', async () => {
    state.staff = { userId: 'staff-1' };
    const res = await review(jsonReq('/x', { item: 'gloves', decision: 'reject', reason: '' }), ctx('drv-1'));
    expect(res.status).toBe(400);
  });

  it('approves the legacy insurance card on file, recording the reviewer', async () => {
    state.staff = { userId: 'staff-1' };
    state.adminHandler = (t, ops, term) => {
      if (t === 'drivers') return { data: driverRow, error: null };
      if (t === 'driver_review_items' && ops.some((o) => o[0] === 'upsert')) return { data: { item: 'insurance_card', status: 'approved' }, error: null };
      return { data: null, error: null };
    };
    const res = await review(jsonReq('/x', { item: 'insurance_card', decision: 'approve', photo_path: 'insurance/legacy.jpg', uploaded_at: null }), ctx('drv-1'));
    expect(res.status).toBe(200);
    const [up] = opsOf(state.adminLog, 'driver_review_items', 'upsert');
    expect(up[1]).toMatchObject({
      driver_id: 'drv-1', item: 'insurance_card', photo_path: 'insurance/legacy.jpg',
      status: 'approved', reason: null, reviewed_by: 'staff-1',
    });
  });

  it('refuses to approve a photo dispatch did not see (driver retook it)', async () => {
    state.staff = { userId: 'staff-1' };
    state.adminHandler = (t) => (t === 'drivers' ? { data: driverRow, error: null } : { data: null, error: null });
    const res = await review(jsonReq('/x', { item: 'insurance_card', decision: 'approve', photo_path: 'insurance/older.jpg', uploaded_at: null }), ctx('drv-1'));
    expect(res.status).toBe(409);
    expect(opsOf(state.adminLog, 'driver_review_items', 'upsert')).toEqual([]);
  });

  it('refuses to review an item with nothing uploaded, and incomplete dimensions', async () => {
    state.staff = { userId: 'staff-1' };
    state.adminHandler = (t) => (t === 'drivers' ? { data: driverRow, error: null } : { data: null, error: null });
    expect((await review(jsonReq('/x', { item: 'gloves', decision: 'approve', uploaded_at: null }), ctx('drv-1'))).status).toBe(409);
    expect((await review(jsonReq('/x', { item: 'cargo_dimensions', decision: 'approve', uploaded_at: null }), ctx('drv-1'))).status).toBe(409);
  });

  it('QA N2: refuses when the review version changed since dispatch opened the page', async () => {
    state.staff = { userId: 'staff-1' };
    const V1 = '2026-10-28T05:00:00.111111+00:00';
    const V2 = '2026-10-28T05:03:00.222222+00:00';
    state.adminHandler = (t, ops, term) => {
      if (t === 'drivers') return { data: driverRow, error: null };
      if (t === 'driver_review_items' && term === 'maybeSingle') {
        return { data: { photo_path: 'insurance/legacy.jpg', uploaded_at: V2, owned: true }, error: null };
      }
      if (t === 'driver_review_items' && ops.some((o) => o[0] === 'upsert')) return { data: { status: 'approved' }, error: null };
      return { data: null, error: null };
    };
    // Same file, but the driver changed insurance dates after the page loaded.
    let res = await review(jsonReq('/x', { item: 'insurance_card', decision: 'approve', photo_path: 'insurance/legacy.jpg', uploaded_at: V1 }), ctx('drv-1'));
    expect(res.status).toBe(409);
    res = await review(jsonReq('/x', { item: 'insurance_card', decision: 'approve', photo_path: 'insurance/legacy.jpg', uploaded_at: null }), ctx('drv-1'));
    expect(res.status).toBe(409);
    expect(opsOf(state.adminLog, 'driver_review_items', 'upsert')).toEqual([]);
    res = await review(jsonReq('/x', { item: 'insurance_card', decision: 'approve', photo_path: 'insurance/legacy.jpg', uploaded_at: V2 }), ctx('drv-1'));
    expect(res.status).toBe(200);
  });

  it('QA N2: a request without a version is refused', async () => {
    state.staff = { userId: 'staff-1' };
    const res = await review(jsonReq('/x', { item: 'insurance_card', decision: 'approve', photo_path: 'insurance/legacy.jpg' }), ctx('drv-1'));
    expect(res.status).toBe(400);
  });

  it('refuses to approve gear the driver no longer lists', async () => {
    state.staff = { userId: 'staff-1' };
    const V = '2026-10-28T05:00:00.1+00:00';
    state.adminHandler = (t, _ops, term) => {
      if (t === 'drivers') return { data: driverRow, error: null };
      if (t === 'driver_review_items' && term === 'maybeSingle') return { data: { photo_path: 'g.jpg', uploaded_at: V, owned: false }, error: null };
      return { data: null, error: null };
    };
    const res = await review(jsonReq('/x', { item: 'gloves', decision: 'approve', photo_path: 'g.jpg', uploaded_at: V }), ctx('drv-1'));
    expect(res.status).toBe(409);
  });
});

// Every required vehicle / document item on file (ruling 2026-10-28).
const UPLOADED = {
  vehicle_photo_front_url: 'f.jpg',
  vehicle_photo_back_url: 'b.jpg',
  vehicle_photo_side_url: 's.jpg',
  vehicle_photo_cargo_url: 'c2.jpg',
  cargo_length_in: 100,
  cargo_width_in: 50,
  cargo_height_in: 40,
  cargo_capacity_lbs: 1000,
  registration_url: 'r.jpg',
};

describe('POST /api/driver/offers/:id/respond (new-work block)', () => {
  const future = new Date(Date.now() + 10 * 60_000).toISOString();
  const today = pacificToday();
  function setup(
    insurance: { insurance_card_url: string | null; insurance_expiry: string | null },
    reviewRow: Record<string, unknown> | null,
    extra: Record<string, unknown> = UPLOADED
  ) {
    state.callerDriver = { id: 'drv-1', status: 'active', current_delivery_id: null };
    state.adminHandler = (t, ops, term) => {
      if (t === 'job_offers' && term === 'maybeSingle') {
        return { data: { id: 'off-1', delivery_id: 'del-1', driver_id: 'drv-1', status: 'pending', expires_at: future }, error: null };
      }
      if (t === 'deliveries' && term === 'maybeSingle') return { data: { id: 'del-1', status: 'booked', driver_id: null }, error: null };
      if (t === 'drivers' && term === 'maybeSingle') return { data: { ...extra, ...insurance }, error: null };
      if (t === 'driver_review_items' && term === 'await') {
        return { data: reviewRow ? [{ item: 'insurance_card', ...reviewRow }] : [], error: null };
      }
      if (t === 'deliveries' && ops.some((o) => o[0] === 'update')) return { data: [{ id: 'del-1' }], error: null };
      return { data: null, error: null };
    };
  }

  it('refuses accept when insurance expired, without touching the job', async () => {
    setup({ insurance_card_url: 'c.jpg', insurance_expiry: '2000-01-01' }, { status: 'approved', photo_path: 'c.jpg' });
    const res = await respond(jsonReq('/x', { action: 'accept' }), ctx('off-1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.blocked_reason).toBe('Insurance expired on 2000-01-01');
    expect(body.error).toMatch(/can't take new jobs/);
    expect(opsOf(state.adminLog, 'deliveries', 'update')).toEqual([]);
  });

  it('refuses accept when the current card is pending review', async () => {
    setup({ insurance_card_url: 'c.jpg', insurance_expiry: '2099-01-01' }, { status: 'pending', photo_path: 'c.jpg' });
    const res = await respond(jsonReq('/x', { action: 'accept' }), ctx('off-1'));
    expect(res.status).toBe(403);
  });

  it('refuses accept when a required item is missing, naming it', async () => {
    const { vehicle_photo_cargo_url: _omit, ...withoutCargo } = UPLOADED;
    void _omit;
    setup({ insurance_card_url: 'c.jpg', insurance_expiry: '2099-01-01' }, { status: 'approved', photo_path: 'c.jpg' }, withoutCargo);
    const res = await respond(jsonReq('/x', { action: 'accept' }), ctx('off-1'));
    expect(res.status).toBe(403);
    expect((await res.json()).blocked_reason).toBe('Missing required items: Cargo area');
    expect(opsOf(state.adminLog, 'deliveries', 'update')).toEqual([]);
  });

  it('still lets a blocked driver decline', async () => {
    setup({ insurance_card_url: null, insurance_expiry: null }, null);
    const res = await respond(jsonReq('/x', { action: 'decline' }), ctx('off-1'));
    expect(res.status).toBe(200);
  });

  it('allows accept with an approved card that expires today (Pacific)', async () => {
    setup({ insurance_card_url: 'c.jpg', insurance_expiry: today }, { status: 'approved', photo_path: 'c.jpg' });
    const res = await respond(jsonReq('/x', { action: 'accept' }), ctx('off-1'));
    expect(res.status).toBe(200);
    expect(opsOf(state.adminLog, 'deliveries', 'update')).toHaveLength(1);
  });
});

describe('GET /api/driver/offers (gear shown before accept)', () => {
  it('includes the job gear list as labels, ignoring unknown ids', async () => {
    state.callerDriver = { id: 'drv-1', status: 'active', current_delivery_id: null };
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    state.adminHandler = (t, _ops, term) => {
      if (t === 'drivers' && term === 'maybeSingle') {
        return { data: { ...UPLOADED, insurance_card_url: 'c.jpg', insurance_expiry: '2099-01-01' }, error: null };
      }
      if (t === 'driver_review_items' && term === 'await') {
        return { data: [{ item: 'insurance_card', status: 'approved', photo_path: 'c.jpg' }], error: null };
      }
      if (t === 'job_offers') {
        return {
          data: [{
            id: 'off-1', delivery_id: 'del-1', expires_at: future, created_at: future, estimated_payout: 40, distance_to_pickup_miles: 3,
            delivery: {
              status: 'booked', driver_id: null, pickup_city: 'A', pickup_state: 'CA', delivery_city: 'B', delivery_state: 'CA',
              required_equipment: ['hi_vis_vest', 'safety_glasses', 'bogus'],
            },
          }],
          error: null,
        };
      }
      return { data: null, error: null };
    };
    ip += 1;
    const res = await offersList(new NextRequest('http://localhost/api/driver/offers', { headers: { 'x-forwarded-for': `10.7.0.${ip % 250}` } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.offers[0].required_equipment).toEqual(['Hi-vis safety vest', 'Safety glasses']);
  });
});
