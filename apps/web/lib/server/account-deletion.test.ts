import { describe, it, expect, vi } from 'vitest';
import { deleteOwnAccount, deletedEmailFor } from './account-deletion';

const USER = '11111111-2222-4333-8444-555555555555';

interface Opts {
  role?: string;
  driver?: Record<string, unknown> | null;
  openCustomer?: number;
  openDriver?: number;
  deleteUserError?: { message: string } | null;
  folder?: Array<{ name: string }>;
}

function fakeAdmin(o: Opts) {
  const calls: Array<{ table: string; op: string; args: unknown[]; filters: unknown[][] }> = [];
  const from = (table: string) => {
    const rec = { table, op: '', args: [] as unknown[], filters: [] as unknown[][] };
    calls.push(rec);
    const chain: Record<string, unknown> = {};
    const result = () => {
      if (table === 'profiles' && rec.op === 'select') return { data: o.role ? { id: USER, role: o.role } : null };
      if (table === 'drivers' && rec.op === 'select') return { data: o.driver ?? null };
      if (table === 'deliveries' && rec.op === 'select') {
        const byDriver = rec.filters.some((f) => f[0] === 'eq' && f[1] === 'driver_id');
        return { count: byDriver ? (o.openDriver ?? 0) : (o.openCustomer ?? 0) };
      }
      return { error: null };
    };
    for (const op of ['select', 'update', 'delete']) {
      chain[op] = (...args: unknown[]) => {
        rec.op = op;
        rec.args = args;
        return chain;
      };
    }
    for (const f of ['eq', 'in', 'lt']) {
      chain[f] = (...args: unknown[]) => {
        rec.filters.push([f, ...args]);
        return chain;
      };
    }
    chain.maybeSingle = async () => result();
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return chain;
  };
  const remove = vi.fn(async () => ({ error: null }));
  const admin = {
    from,
    storage: {
      from: () => ({ list: vi.fn(async () => ({ data: o.folder ?? [] })), remove }),
    },
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ error: o.deleteUserError ?? null })),
        updateUserById: vi.fn(async () => ({ error: null })),
      },
    },
  };
  return { admin: admin as never, calls, remove, auth: admin.auth.admin };
}

describe('deleteOwnAccount', () => {
  it('refuses staff accounts', async () => {
    const f = fakeAdmin({ role: 'dispatcher' });
    const r = await deleteOwnAccount(f.admin, USER);
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(f.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('refuses while a job is in progress, as customer or driver', async () => {
    const a = await deleteOwnAccount(fakeAdmin({ role: 'customer', openCustomer: 1 }).admin, USER);
    expect(a).toMatchObject({ ok: false, status: 409 });
    const f = fakeAdmin({ role: 'driver', driver: { id: 'd1' }, openDriver: 1 });
    expect(await deleteOwnAccount(f.admin, USER)).toMatchObject({ ok: false, status: 409 });
    expect(f.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('fully deletes an account with no history, after cancelling unstarted bookings', async () => {
    const f = fakeAdmin({ role: 'customer' });
    expect(await deleteOwnAccount(f.admin, USER)).toEqual({ ok: true, mode: 'deleted' });
    const cancel = f.calls.find((c) => c.table === 'deliveries' && c.op === 'update');
    expect(cancel?.args[0]).toEqual({ status: 'cancelled' });
    expect(f.auth.deleteUser).toHaveBeenCalledWith(USER);
    expect(f.auth.updateUserById).not.toHaveBeenCalled();
  });

  it('removes a driver’s document files, only safe paths', async () => {
    const f = fakeAdmin({
      role: 'driver',
      driver: { id: 'd1', license_front_url: 'licenses/123-a.jpg', insurance_card_url: '../evil', registration_url: null },
      folder: [{ name: 'license_front-1.jpg' }],
    });
    await deleteOwnAccount(f.admin, USER);
    expect(f.remove).toHaveBeenCalledWith(['licenses/123-a.jpg', `drivers/${USER}/license_front-1.jpg`]);
  });

  it('wipes personal details and bans the sign-in when history blocks a hard delete', async () => {
    const f = fakeAdmin({ role: 'driver', driver: { id: 'd1' }, deleteUserError: { message: 'foreign key' } });
    expect(await deleteOwnAccount(f.admin, USER)).toEqual({ ok: true, mode: 'anonymized' });
    const profile = f.calls.find((c) => c.table === 'profiles' && c.op === 'update');
    expect(profile?.args[0]).toMatchObject({ full_name: 'Deleted account', email: deletedEmailFor(USER), phone: null });
    const drv = f.calls.find((c) => c.table === 'drivers' && c.op === 'update');
    expect(drv?.args[0]).toMatchObject({ vehicle_plate: null, license_front_url: null, status: 'inactive', is_online: false });
    expect(f.calls.some((c) => c.table === 'driver_locations' && c.op === 'delete')).toBe(true);
    expect(f.calls.some((c) => c.table === 'push_subscriptions' && c.op === 'delete')).toBe(true);
    expect(f.auth.updateUserById).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ email: deletedEmailFor(USER), ban_duration: '876000h' })
    );
  });
});
