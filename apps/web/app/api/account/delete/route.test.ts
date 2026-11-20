// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const USER = '11111111-2222-4333-8444-555555555555';
const state = { user: null as { id: string } | null, signedOut: false };
const deleteOwnAccount = vi.fn(async () => ({ ok: true as const, mode: 'deleted' as const }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      signOut: async () => {
        state.signedOut = true;
      },
    },
  }),
}));
vi.mock('@/lib/server/driver-session', () => ({ createServiceClient: () => ({}) }));
vi.mock('@/lib/server/account-deletion', async () => ({
  DELETE_CONFIRM_WORD: 'DELETE',
  deleteOwnAccount: (...a: unknown[]) => deleteOwnAccount(...(a as [])),
}));

import { POST } from './route';

const req = (body: unknown) =>
  new NextRequest('https://epyccs.com/api/account/delete', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  state.user = { id: USER };
  state.signedOut = false;
  deleteOwnAccount.mockClear();
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
});

describe('POST /api/account/delete', () => {
  it('needs a session', async () => {
    state.user = null;
    expect((await POST(req({ confirm: 'DELETE' }))).status).toBe(401);
  });

  it('needs DELETE typed', async () => {
    expect((await POST(req({ confirm: 'yes' }))).status).toBe(400);
    expect(deleteOwnAccount).not.toHaveBeenCalled();
  });

  it('deletes the session user only, then signs out', async () => {
    const res = await POST(req({ confirm: 'delete', userId: 'someone-else' }));
    expect(res.status).toBe(200);
    expect(deleteOwnAccount).toHaveBeenCalledWith(expect.anything(), USER);
    expect(state.signedOut).toBe(true);
  });

  it('answers 503 without the service key', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await POST(req({ confirm: 'DELETE' }))).status).toBe(503);
  });
});
