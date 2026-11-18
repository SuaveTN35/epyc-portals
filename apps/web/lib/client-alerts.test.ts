import { describe, expect, it } from 'vitest';
import {
  CLIENT_ALERT_EVENTS,
  CLIENT_SMS_CONSENT_TEXT,
  CLIENT_SMS_KIND,
  MAX_TRACKING_PHOTOS,
  clientAlertParagraphs,
  clientAlertSubject,
  clientAlertText,
  clientEventForStatus,
  cleanReceivedBy,
  formatPacificDateTime,
  formatPacificTime,
  hidesPhotosOnPublicPage,
  jobRef,
  portalLink,
  selectTrackingProof,
  shouldAlertClient,
  trackingHeadline,
  trackingSteps,
  type ClientAlertJob,
  type TrackingProofRow,
} from './client-alerts';
import { clientDeliveryAlertEmail } from './email';

const ID = '3f2a9c1e-1111-4222-8333-944455556666';
const job: ClientAlertJob = {
  id: ID,
  tracking_number: 'EPYC-1042',
  pickup_city: 'Burbank',
  delivery_city: 'Pasadena',
  // 22:41 UTC on Nov 18 is 2:41 PM Pacific (PST, UTC-8).
  actual_pickup_time: '2026-11-18T22:41:00Z',
  actual_delivery_time: '2026-11-18T23:30:00Z',
};
const LINK = 'https://www.epyccs.com/track/x/y';
const isAscii = (s: string) => /^[\x20-\x7e\n]*$/.test(s);

describe('clientEventForStatus', () => {
  it('maps driver statuses to the alert they call for', () => {
    expect(clientEventForStatus('assigned')).toBe('assigned');
    expect(clientEventForStatus('en_route_pickup')).toBe('assigned');
    expect(clientEventForStatus('arrived_pickup')).toBe('assigned');
    expect(clientEventForStatus('picked_up')).toBe('picked_up');
    expect(clientEventForStatus('en_route_delivery')).toBe('picked_up');
    expect(clientEventForStatus('arrived_delivery')).toBe('picked_up');
    expect(clientEventForStatus('delivered')).toBe('delivered');
  });

  it('sends nothing before assignment or after a cancel or failure', () => {
    for (const s of ['quote_requested', 'quoted', 'booked', 'cancelled', 'failed', '', null, undefined, 'bogus']) {
      expect(clientEventForStatus(s as string)).toBeNull();
    }
  });

  it('has an sms_log kind for every event', () => {
    for (const e of CLIENT_ALERT_EVENTS) expect(CLIENT_SMS_KIND[e]).toMatch(/^client_/);
  });
});

describe('client texts', () => {
  it('say what happened, with cities, Pacific time and the link', () => {
    expect(clientAlertText('assigned', job, LINK)).toBe(
      `EPYC: A driver is assigned to your delivery EPYC-1042 (Burbank to Pasadena). Track it: ${LINK}`
    );
    expect(clientAlertText('picked_up', job, LINK)).toBe(
      `EPYC: Your delivery EPYC-1042 was picked up in Burbank at 2:41 PM. Photos and status: ${LINK}`
    );
    expect(clientAlertText('delivered', job, LINK)).toBe(
      `EPYC: Your delivery EPYC-1042 was delivered in Pasadena at 3:30 PM. Proof of delivery: ${LINK}`
    );
  });

  it('leave the time out when it is missing', () => {
    expect(clientAlertText('picked_up', { ...job, actual_pickup_time: null }, LINK)).toBe(
      `EPYC: Your delivery EPYC-1042 was picked up in Burbank. Photos and status: ${LINK}`
    );
  });

  it('never carry a street address and stay plain ASCII', () => {
    const withStreet = { ...job, pickup_city: '123 Main St\nApt 4', delivery_city: null };
    for (const e of CLIENT_ALERT_EVENTS) {
      const t = clientAlertText(e, withStreet, LINK);
      expect(t).not.toContain('\n');
      expect(isAscii(t)).toBe(true);
    }
    expect(clientAlertText('delivered', withStreet, LINK)).toContain('delivered in drop-off');
  });

  it('use a short id when the tracking number is odd', () => {
    expect(jobRef('<script>', ID)).toBe('3F2A9C1E');
    expect(jobRef(null, ID)).toBe('3F2A9C1E');
    expect(jobRef('EPYC-7', ID)).toBe('EPYC-7');
  });
});

describe('client emails', () => {
  it('have a subject per event', () => {
    expect(clientAlertSubject('assigned', job)).toBe('A driver is assigned to your delivery EPYC-1042');
    expect(clientAlertSubject('picked_up', job)).toBe('Your delivery EPYC-1042 was picked up');
    expect(clientAlertSubject('delivered', job)).toBe('Your delivery EPYC-1042 was delivered');
  });

  it('name who received it on delivery', () => {
    const p = clientAlertParagraphs({ event: 'delivered', job, link: LINK, firstName: 'Ana', receivedBy: 'J. Ortiz' });
    expect(p[0]).toBe('Your delivery EPYC-1042 was delivered in Pasadena on Wed, Nov 18 at 3:30 PM. It was received by J. Ortiz.');
  });

  it('escape names and links in the HTML and keep the text ASCII', () => {
    const m = clientDeliveryAlertEmail({
      event: 'picked_up',
      job,
      link: LINK,
      firstName: '<b>Ana</b> Lopez',
      receivedBy: null,
    });
    expect(m.subject).toBe('Your delivery EPYC-1042 was picked up');
    expect(m.html).toContain('Hi &lt;b&gt;Ana&lt;/b&gt;,');
    expect(m.html).toContain(`href="${LINK}"`);
    expect(m.text).toContain(`Track this delivery: ${LINK}`);
    expect(isAscii(m.text)).toBe(true);
  });
});

describe('formatting helpers', () => {
  it('formats Pacific times and rejects bad input', () => {
    expect(formatPacificTime('2026-07-01T19:05:00Z')).toBe('12:05 PM'); // PDT, UTC-7
    expect(formatPacificTime('nope')).toBeNull();
    expect(formatPacificTime(null)).toBeNull();
    expect(formatPacificDateTime('2026-11-18T22:41:00Z')).toBe('Wed, Nov 18 at 2:41 PM');
  });

  it('cleans recipient names', () => {
    expect(cleanReceivedBy('  Jo\n Ortiz ')).toBe('Jo Ortiz');
    expect(cleanReceivedBy('')).toBeNull();
    expect(cleanReceivedBy('x'.repeat(100))).toHaveLength(60);
  });

  it('builds the portal fallback link', () => {
    expect(portalLink(ID)).toBe(`https://www.epyccs.com/client/deliveries/${ID}`);
  });

  it('keeps the consent text plain ASCII and mentions STOP', () => {
    expect(isAscii(CLIENT_SMS_CONSENT_TEXT)).toBe(true);
    expect(CLIENT_SMS_CONSENT_TEXT).toContain('Reply STOP');
  });
});

describe('tracking page', () => {
  const rows: TrackingProofRow[] = [
    { type: 'photo', stage: 'pickup', photo_kind: 'item', photo_url: `${ID}/a.jpg`, signature_data: null, recipient_name: null },
    { type: 'photo', stage: 'pickup', photo_kind: 'receipt', photo_url: `${ID}/r.jpg`, signature_data: null, recipient_name: null },
    { type: 'photo', stage: 'delivery', photo_kind: 'placement', photo_url: `${ID}/p.jpg`, signature_data: null, recipient_name: null },
    { type: 'photo', stage: 'delivery', photo_kind: 'recipient', photo_url: `${ID}/face.jpg`, signature_data: null, recipient_name: null },
    { type: 'signature', stage: 'delivery', photo_kind: null, photo_url: null, signature_data: 'data:image/png;base64,AAA=', recipient_name: 'Jo Ortiz' },
  ];

  it('shows item and placement photos, never receipts or recipient photos', () => {
    const p = selectTrackingProof(rows, false);
    expect(p.pickupPhotoPaths).toEqual([`${ID}/a.jpg`]);
    expect(p.dropoffPhotoPaths).toEqual([`${ID}/p.jpg`]);
    expect(p.signatureData).toBe('data:image/png;base64,AAA=');
    expect(p.receivedBy).toBe('Jo Ortiz');
  });

  it('shows no photos on medical or HIPAA jobs', () => {
    expect(hidesPhotosOnPublicPage({ is_medical: true })).toBe(true);
    expect(hidesPhotosOnPublicPage({ is_hipaa: true })).toBe(true);
    expect(hidesPhotosOnPublicPage({ is_medical: false, is_hipaa: null })).toBe(false);
    const p = selectTrackingProof(rows, true);
    expect(p.pickupPhotoPaths).toEqual([]);
    expect(p.dropoffPhotoPaths).toEqual([]);
  });

  it('caps photos per section', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...rows[0], photo_url: `${ID}/${i}.jpg` }));
    expect(selectTrackingProof(many, false).pickupPhotoPaths).toHaveLength(MAX_TRACKING_PHOTOS);
  });

  it('marks steps done up to the current status', () => {
    const done = (status: string) => trackingSteps({ status }).map((s) => s.done);
    expect(done('booked')).toEqual([true, false, false, false]);
    expect(done('en_route_pickup')).toEqual([true, true, false, false]);
    expect(done('arrived_delivery')).toEqual([true, true, true, false]);
    expect(done('delivered')).toEqual([true, true, true, true]);
    expect(done('cancelled')).toEqual([false, false, false, false]);
  });

  it('has a plain headline for every status', () => {
    expect(trackingHeadline('picked_up')).toBe('Picked up, on the way');
    expect(trackingHeadline('delivered')).toBe('Delivered');
    expect(trackingHeadline('weird')).toBe('In progress');
  });
});

describe('shouldAlertClient', () => {
  it('alerts client accounts on Epyc jobs only', () => {
    expect(shouldAlertClient({ source: 'direct' }, { role: 'client' })).toBe(true);
    expect(shouldAlertClient({ source: 'dispatch_app' }, { role: 'customer' })).toBe(true);
    expect(shouldAlertClient({ source: null }, { role: 'member' })).toBe(true);
  });

  it('skips staff, drivers and partner-platform jobs', () => {
    expect(shouldAlertClient({ source: 'direct' }, { role: 'dispatcher' })).toBe(false);
    expect(shouldAlertClient({ source: 'direct' }, { role: 'admin' })).toBe(false);
    expect(shouldAlertClient({ source: 'direct' }, { role: 'driver' })).toBe(false);
    expect(shouldAlertClient({ source: 'direct' }, { role: null })).toBe(false);
    expect(shouldAlertClient({ source: 'curri' }, { role: 'client' })).toBe(false);
    expect(shouldAlertClient({ source: 'broker' }, { role: 'client' })).toBe(false);
    expect(shouldAlertClient({ source: 'walmart_spark' }, { role: 'client' })).toBe(false);
    expect(shouldAlertClient({ source: 'other' }, { role: 'client' })).toBe(false);
  });
});
