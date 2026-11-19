import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const insertSingle = vi.fn();
const sendEmail = vi.fn();

vi.mock('@/lib/server/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: () => ({ select: () => ({ single: insertSingle }) }) }),
  }),
}));
vi.mock('@/lib/email', async (orig) => {
  const real = await orig<typeof import('@/lib/email')>();
  return { ...real, sendEmail: (...a: unknown[]) => sendEmail(...a) };
});

const body = {
  contact_name: 'Pat Lee',
  contact_phone: '8185550100',
  contact_email: 'pat@example.com',
  pickup_address: '1 A St, Burbank',
  dropoff_address: '2 B St, Pasadena',
  item_type: 'medical',
  service_level: 'asap',
};

let ip = 0;
function req(b: unknown) {
  ip += 1;
  return new NextRequest('http://localhost/api/public/delivery-request', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${ip}` },
    body: JSON.stringify(b),
  });
}

describe('POST /api/public/delivery-request', () => {
  beforeEach(() => {
    insertSingle.mockReset();
    sendEmail.mockReset();
  });

  it('saves, alerts ops, then acknowledges the customer', async () => {
    insertSingle.mockResolvedValue({ data: { reference: 'REQ-TEST0001' }, error: null });
    sendEmail.mockResolvedValue({ sent: true });
    const { POST } = await import('./route');
    const res = await POST(req(body));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, reference: 'REQ-TEST0001', saved: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0][0].to).toBe('admin@epyccs.com');
    expect(sendEmail.mock.calls[0][0].replyTo).toBe('pat@example.com');
    expect(sendEmail.mock.calls[1][0].to).toBe('pat@example.com');
  });

  it('still succeeds by email when the database save fails', async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } });
    sendEmail.mockResolvedValue({ sent: true });
    const { POST } = await import('./route');
    const res = await POST(req(body));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.saved).toBe(false);
    expect(sendEmail.mock.calls[0][0].text).toContain('only copy');
  });

  it('fails with the phone number when neither save nor email works, and sends no ack', async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: 'down' } });
    sendEmail.mockResolvedValue({ sent: false, skipped: 'no key' });
    const { POST } = await import('./route');
    const res = await POST(req(body));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('(818) 217-0070');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('stores nothing for a bot that fills the honeypot', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ ...body, website: 'spam' }));
    expect((await res.json()).ok).toBe(true);
    expect(insertSingle).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
