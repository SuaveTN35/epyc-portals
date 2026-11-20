import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstile, tokenFrom } from './turnstile';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('verifyTurnstile', () => {
  it('is off when no secret is configured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect(await verifyTurnstile(null)).toEqual({ ok: true, reason: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks a missing token when on', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    expect(await verifyTurnstile(null)).toEqual({ ok: false, reason: 'missing' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes a token Cloudflare accepts', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ success: true }) });
    expect(await verifyTurnstile('tok', '203.0.113.5')).toEqual({ ok: true, reason: 'verified' });
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain('response=tok');
    expect(body).toContain('remoteip=203.0.113.5');
  });

  it('blocks a token Cloudflare rejects', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });
    expect(await verifyTurnstile('bad')).toEqual({ ok: false, reason: 'rejected' });
  });

  it('allows when Cloudflare is unreachable', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    fetchMock.mockRejectedValue(new Error('timeout'));
    expect(await verifyTurnstile('tok')).toEqual({ ok: true, reason: 'unreachable' });
  });

  it('allows when Cloudflare returns 5xx', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    fetchMock.mockResolvedValue({ status: 503, json: async () => ({}) });
    expect(await verifyTurnstile('tok')).toEqual({ ok: true, reason: 'unreachable' });
  });

  it('does not send a user-agent fallback as remoteip', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ success: true }) });
    await verifyTurnstile('tok', 'ua:Mozilla');
    expect(String(fetchMock.mock.calls[0][1].body)).not.toContain('remoteip');
  });
});

describe('tokenFrom', () => {
  it('reads a string token', () => {
    expect(tokenFrom({ turnstile_token: 'abc' })).toBe('abc');
  });
  it('ignores non-strings, empty and oversized values', () => {
    expect(tokenFrom({ turnstile_token: 5 })).toBeNull();
    expect(tokenFrom({ turnstile_token: '' })).toBeNull();
    expect(tokenFrom({ turnstile_token: 'x'.repeat(2049) })).toBeNull();
    expect(tokenFrom(null)).toBeNull();
  });
});
