import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
let adminAvailable = true;

vi.mock('./supabase-admin', () => ({
  createAdminClient: () => (adminAvailable ? { rpc } : null),
}));

import { checkDurableRateLimit } from './durable-rate-limit';
import { getClientIdentifier } from '../rate-limit';

const cfg = { limit: 5, windowSeconds: 600 };
let n = 0;
const id = () => `test:${++n}`;

beforeEach(() => {
  rpc.mockReset();
  adminAvailable = true;
});

describe('checkDurableRateLimit', () => {
  it('uses the shared count from the database', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, hits: 6, reset_at: '2026-11-19T08:00:00Z' }], error: null });
    const r = await checkDurableRateLimit(id(), cfg);
    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('allows when the database says allowed', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, hits: 2, reset_at: '2026-11-19T08:00:00Z' }], error: null });
    const r = await checkDurableRateLimit(id(), cfg);
    expect(r.success).toBe(true);
    expect(r.remaining).toBe(3);
  });

  it('never sends the raw identifier to the database', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, hits: 1, reset_at: '2026-11-19T08:00:00Z' }], error: null });
    await checkDurableRateLimit('contact:203.0.113.9', cfg);
    const args = rpc.mock.calls[0][1];
    expect(args.p_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain('203.0.113.9');
  });

  it('falls back to in-memory when the database errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function missing' } });
    const r = await checkDurableRateLimit(id(), cfg);
    expect(r.success).toBe(true);
  });

  it('falls back to in-memory when the database throws', async () => {
    rpc.mockRejectedValue(new Error('network'));
    const r = await checkDurableRateLimit(id(), cfg);
    expect(r.success).toBe(true);
  });

  it('falls back when no service role is configured', async () => {
    adminAvailable = false;
    const r = await checkDurableRateLimit(id(), cfg);
    expect(r.success).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('in-memory limit still blocks a burst without a database call', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, hits: 1, reset_at: '2026-11-19T08:00:00Z' }], error: null });
    const key = id();
    for (let i = 0; i < 5; i++) await checkDurableRateLimit(key, cfg);
    rpc.mockClear();
    const r = await checkDurableRateLimit(key, cfg);
    expect(r.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('getClientIdentifier', () => {
  it('prefers the Vercel platform header over x-forwarded-for', () => {
    const req = new Request('http://x', {
      headers: { 'x-vercel-forwarded-for': '198.51.100.7', 'x-forwarded-for': '6.6.6.6' },
    });
    expect(getClientIdentifier(req)).toBe('198.51.100.7');
  });
});
