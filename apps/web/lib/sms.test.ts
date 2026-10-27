import { describe, expect, it } from 'vitest';
import {
  SMS_CONSENT_TEXT,
  assignedText,
  formatPayout,
  normalizePhone,
  offerText,
  parseAssignedSmsRequest,
  parseOfferSmsRequest,
  problemOpsText,
  smsConfigFrom,
  twilioRequest,
  withOptOutFooter,
} from './sms';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

describe('normalizePhone (E.164, US default)', () => {
  it('formats common US inputs', () => {
    expect(normalizePhone('(818) 217-0070')).toBe('+18182170070');
    expect(normalizePhone('818.217.0070')).toBe('+18182170070');
    expect(normalizePhone('1-818-217-0070')).toBe('+18182170070');
    expect(normalizePhone('+1 818 217 0070')).toBe('+18182170070');
  });
  it('keeps valid international numbers', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });
  it('rejects junk and impossible US numbers', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('018-217-0070')).toBeNull(); // area code cannot start with 0
    expect(normalizePhone('818-117-0070')).toBeNull(); // exchange cannot start with 1
    expect(normalizePhone('+1 818 217 007')).toBeNull();
    expect(normalizePhone('+0123456789')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
  });
});

describe('message text', () => {
  it('offer text matches the approved wording', () => {
    expect(offerText({ pickupCity: 'Downey', dropoffCity: 'Irvine', payout: 45 })).toBe(
      'EPYC: New job offer - Downey to Irvine, $45. Open the app to accept: https://www.epyccs.com/driver/jobs'
    );
    expect(offerText({ pickupCity: 'Downey', dropoffCity: 'Irvine', payout: '42.5' })).toContain(', $42.50.');
  });
  it('offer text drops the amount when there is no payout', () => {
    expect(offerText({ pickupCity: 'Downey', dropoffCity: 'Irvine', payout: null })).toBe(
      'EPYC: New job offer - Downey to Irvine. Open the app to accept: https://www.epyccs.com/driver/jobs'
    );
  });
  it('offer text strips control characters and caps city length', () => {
    const t = offerText({ pickupCity: 'Los\nAngeles', dropoffCity: 'x'.repeat(80), payout: 10 });
    expect(t).toContain('Los Angeles to ' + 'x'.repeat(40) + ',');
    expect(offerText({ pickupCity: '', dropoffCity: null, payout: 10 })).toContain('pickup to drop-off');
  });
  it('assigned text links to the job', () => {
    expect(assignedText(U1)).toBe(`EPYC: You've been assigned a job. Open: https://www.epyccs.com/driver/delivery/${U1}`);
  });
  it('ops text uses the reason label and a job reference only', () => {
    expect(problemOpsText({ reasonLabel: 'Store not ready', deliveryId: U1, jobRef: 'EPYC-1234' })).toBe(
      `EPYC: Driver reported a problem on job EPYC-1234: Store not ready. Open: https://www.epyccs.com/dispatch/deliveries/${U1}`
    );
    expect(problemOpsText({ reasonLabel: 'Other', deliveryId: U1, jobRef: 'bad ref; drop' })).toContain('job 11111111:');
  });
  it('adds the STOP footer only on the first text', () => {
    expect(withOptOutFooter('Hi.', true)).toBe('Hi. Reply STOP to opt out.');
    expect(withOptOutFooter('Hi.', false)).toBe('Hi.');
  });
  it('consent text is exact', () => {
    expect(SMS_CONSENT_TEXT).toBe('Text me job offers and updates. Msg and data rates may apply. Reply STOP to opt out.');
  });
  it('all texts are plain ASCII', () => {
    const all = [offerText({ pickupCity: 'A', dropoffCity: 'B', payout: 1 }), assignedText(U1), SMS_CONSENT_TEXT];
    for (const t of all) expect(/^[\x20-\x7e]*$/.test(t)).toBe(true);
  });
});

describe('formatPayout', () => {
  it('formats or drops', () => {
    expect(formatPayout(45)).toBe('$45');
    expect(formatPayout('45.00')).toBe('$45');
    expect(formatPayout(45.5)).toBe('$45.50');
    expect(formatPayout(0)).toBeNull();
    expect(formatPayout('abc')).toBeNull();
    expect(formatPayout(undefined)).toBeNull();
  });
});

describe('smsConfigFrom', () => {
  const base = { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'tok' };
  it('is null when not configured', () => {
    expect(smsConfigFrom({})).toBeNull();
    expect(smsConfigFrom(base)).toBeNull();
    expect(smsConfigFrom({ ...base, TWILIO_PHONE_NUMBER: 'nope' })).toBeNull();
    expect(smsConfigFrom({ TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '8182170070' })).toBeNull();
  });
  it('uses a from number, normalized', () => {
    expect(smsConfigFrom({ ...base, TWILIO_PHONE_NUMBER: '(818) 217-0070' })).toEqual({
      accountSid: 'AC123',
      authToken: 'tok',
      from: '+18182170070',
    });
  });
  it('prefers a messaging service when set', () => {
    expect(smsConfigFrom({ ...base, TWILIO_PHONE_NUMBER: '8182170070', TWILIO_MESSAGING_SERVICE_SID: 'MG1' })).toEqual({
      accountSid: 'AC123',
      authToken: 'tok',
      messagingServiceSid: 'MG1',
    });
  });
});

describe('twilioRequest', () => {
  it('builds the REST call with basic auth and form body', () => {
    const { url, init } = twilioRequest({ accountSid: 'AC1', authToken: 't', from: '+18182170070' }, '+13105550100', 'Hi & bye');
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Basic ${btoa('AC1:t')}`);
    const form = new URLSearchParams(init.body);
    expect(form.get('To')).toBe('+13105550100');
    expect(form.get('From')).toBe('+18182170070');
    expect(form.get('Body')).toBe('Hi & bye');
    expect(form.has('MessagingServiceSid')).toBe(false);
  });
  it('uses MessagingServiceSid instead of From', () => {
    const { init } = twilioRequest({ accountSid: 'AC1', authToken: 't', messagingServiceSid: 'MG9' }, '+13105550100', 'x');
    const form = new URLSearchParams(init.body);
    expect(form.get('MessagingServiceSid')).toBe('MG9');
    expect(form.has('From')).toBe(false);
  });
});

describe('request parsing', () => {
  it('parses offer requests and dedupes drivers', () => {
    expect(parseOfferSmsRequest({ delivery_id: U1, driver_ids: [U2, U2] })).toEqual({ ok: true, deliveryId: U1, driverIds: [U2] });
  });
  it('rejects bad offer requests', () => {
    expect(parseOfferSmsRequest(null).ok).toBe(false);
    expect(parseOfferSmsRequest({ delivery_id: 'x', driver_ids: [U2] }).ok).toBe(false);
    expect(parseOfferSmsRequest({ delivery_id: U1, driver_ids: [] }).ok).toBe(false);
    expect(parseOfferSmsRequest({ delivery_id: U1, driver_ids: ['nope'] }).ok).toBe(false);
    expect(parseOfferSmsRequest({ delivery_id: U1, driver_ids: Array(51).fill(U2) }).ok).toBe(false);
  });
  it('parses assigned requests', () => {
    expect(parseAssignedSmsRequest({ delivery_id: U1 })).toEqual({ ok: true, deliveryId: U1 });
    expect(parseAssignedSmsRequest({ delivery_id: 1 }).ok).toBe(false);
  });
});
