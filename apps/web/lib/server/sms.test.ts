import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendDriverSms, sendSms } from './sms';

// Minimal fake of the supabase query builder used by lib/server/sms.ts.
function fakeAdmin(opts: { priorSends?: number; profile?: { phone: string | null; sms_opt_in: boolean } | null; recent?: number }) {
  const inserts: Record<string, unknown>[] = [];
  const profileUpdates: Record<string, unknown>[] = [];
  const admin = {
    from(table: string) {
      const chain: any = {
        _countMode: false,
        _filters: [] as string[],
        select(_cols: string, o?: { count?: string; head?: boolean }) {
          chain._countMode = !!o?.head;
          return chain;
        },
        eq(col: string) { chain._filters.push(col); return chain; },
        not() { chain._filters.push('not'); return chain; },
        gte() { chain._filters.push('gte'); return chain; },
        maybeSingle: async () => ({ data: table === 'profiles' ? opts.profile ?? null : null }),
        insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null }; },
        update(row: Record<string, unknown>) {
          profileUpdates.push(row);
          return { eq: async () => ({ error: null }) };
        },
        then(resolve: (v: unknown) => void) {
          // count queries on sms_log
          const isRecent = chain._filters.includes('gte');
          resolve({ count: isRecent ? opts.recent ?? 0 : opts.priorSends ?? 0, error: null });
        },
      };
      return chain;
    },
  };
  return { admin: admin as any, inserts, profileUpdates };
}

const ENV = { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+18182170070' };

describe('sendSms', () => {
  const saved = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a no-op that logs "SMS not configured" when env is missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const { admin, inserts } = fakeAdmin({});
    const info = vi.spyOn(console, 'info');
    expect(await sendSms({ admin, to: '8182170070', body: 'x', kind: 'job_offer' })).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
    expect(info.mock.calls[0][0]).toContain('SMS not configured');
  });

  it('sends, adds the STOP footer on the first text, and logs it', async () => {
    Object.assign(process.env, ENV);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sid: 'SM1', status: 'queued' }), { status: 201 }));
    const { admin, inserts } = fakeAdmin({ priorSends: 0 });
    const r = await sendSms({ admin, to: '(310) 555-0100', body: 'Hello.', kind: 'job_assigned', profileId: 'p1', deliveryId: 'd1', optOutFooterOnFirst: true });
    expect(r).toBe('sent');
    const form = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(form.get('To')).toBe('+13105550100');
    expect(form.get('Body')).toBe('Hello. Reply STOP to opt out.');
    expect(inserts[0]).toMatchObject({ to_number: '+13105550100', kind: 'job_assigned', twilio_sid: 'SM1', status: 'queued', profile_id: 'p1', delivery_id: 'd1' });
  });

  it('omits the footer once the number has been texted', async () => {
    Object.assign(process.env, ENV);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sid: 'SM2', status: 'queued' }), { status: 201 }));
    const { admin } = fakeAdmin({ priorSends: 3 });
    await sendSms({ admin, to: '3105550100', body: 'Hello.', kind: 'job_offer', optOutFooterOnFirst: true });
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('Body')).toBe('Hello.');
  });

  it('never throws on network errors and logs a failure', async () => {
    Object.assign(process.env, ENV);
    fetchMock.mockRejectedValue(new Error('down'));
    const { admin, inserts } = fakeAdmin({});
    await expect(sendSms({ admin, to: '3105550100', body: 'x', kind: 'problem_ops' })).resolves.toBe('failed');
    expect(inserts[0]).toMatchObject({ status: 'failed:network', twilio_sid: null });
  });

  it('turns off sms_opt_in when Twilio says the driver replied STOP (21610)', async () => {
    Object.assign(process.env, ENV);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 21610 }), { status: 400 }));
    const { admin, inserts, profileUpdates } = fakeAdmin({});
    expect(await sendSms({ admin, to: '3105550100', body: 'x', kind: 'job_offer', profileId: 'p1' })).toBe('failed');
    expect(inserts[0]).toMatchObject({ status: 'failed:21610' });
    expect(profileUpdates).toEqual([{ sms_opt_in: false }]);
  });

  it('skips bad numbers without calling Twilio', async () => {
    Object.assign(process.env, ENV);
    const { admin } = fakeAdmin({});
    expect(await sendSms({ admin, to: '123', body: 'x', kind: 'job_offer' })).toBe('skipped_no_phone');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sendDriverSms consent gate', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, ENV);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ sid: 'SM', status: 'queued' }), { status: 201 })));
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not text a driver who has not opted in', async () => {
    const { admin } = fakeAdmin({ profile: { phone: '3105550100', sms_opt_in: false } });
    expect(await sendDriverSms({ admin, profileId: 'p', kind: 'job_offer', deliveryId: 'd', body: 'x' })).toBe('skipped_no_consent');
  });
  it('does not text without a phone', async () => {
    const { admin } = fakeAdmin({ profile: { phone: null, sms_opt_in: true } });
    expect(await sendDriverSms({ admin, profileId: 'p', kind: 'job_offer', deliveryId: 'd', body: 'x' })).toBe('skipped_no_phone');
  });
  it('does not repeat the same text for the same job', async () => {
    const { admin } = fakeAdmin({ profile: { phone: '3105550100', sms_opt_in: true }, recent: 1 });
    expect(await sendDriverSms({ admin, profileId: 'p', kind: 'job_offer', deliveryId: 'd', body: 'x' })).toBe('skipped_duplicate');
  });
  it('texts an opted-in driver', async () => {
    const { admin } = fakeAdmin({ profile: { phone: '3105550100', sms_opt_in: true }, recent: 0 });
    expect(await sendDriverSms({ admin, profileId: 'p', kind: 'job_offer', deliveryId: 'd', body: 'x' })).toBe('sent');
  });
});
