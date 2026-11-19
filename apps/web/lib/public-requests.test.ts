import { describe, it, expect } from 'vitest';
import { deliveryRequestSchema, contactMessageSchema, fieldErrors } from './public-requests';
import { opsNewDeliveryRequest, customerRequestAcknowledgement, opsNewContactMessage, opsNewApplicationAlert } from './email';

const goodRequest = {
  contact_name: 'Pat Lee',
  contact_phone: '(818) 555-0100',
  contact_email: 'pat@example.com',
  company_name: '',
  pickup_address: '100 Main St, Burbank, CA 91502',
  dropoff_address: '200 Lab Way, Pasadena, CA 91101',
  item_type: 'medical',
  item_description: '',
  service_level: 'same_day',
  pickup_date: '',
  time_window: '1 to 3 PM',
  notes: '',
  website: '',
};

describe('deliveryRequestSchema', () => {
  it('accepts a normal request and turns empty optionals into null', () => {
    const r = deliveryRequestSchema.parse(goodRequest);
    expect(r.company_name).toBeNull();
    expect(r.pickup_date).toBeNull();
    expect(r.item_type).toBe('medical');
  });

  it('rejects a short phone number and a missing address', () => {
    const res = deliveryRequestSchema.safeParse({ ...goodRequest, contact_phone: '555-0100', pickup_address: ' ' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const f = fieldErrors(res.error);
      expect(f.contact_phone).toBeTruthy();
      expect(f.pickup_address).toBeTruthy();
    }
  });

  it('rejects an unknown item type', () => {
    expect(deliveryRequestSchema.safeParse({ ...goodRequest, item_type: 'hazmat' }).success).toBe(false);
  });

  it('needs a date when the delivery is scheduled', () => {
    const res = deliveryRequestSchema.safeParse({ ...goodRequest, service_level: 'scheduled' });
    expect(res.success).toBe(false);
    if (!res.success) expect(fieldErrors(res.error).pickup_date).toBeTruthy();
    expect(
      deliveryRequestSchema.safeParse({ ...goodRequest, service_level: 'scheduled', pickup_date: '2026-12-01' }).success
    ).toBe(true);
  });
});

describe('contactMessageSchema', () => {
  it('accepts a message without a phone', () => {
    const m = contactMessageSchema.parse({ full_name: 'Sam', email: 'sam@example.com', subject: 'quote', message: 'Hi' });
    expect(m.phone).toBeNull();
  });
  it('rejects a bad email and an empty message', () => {
    expect(contactMessageSchema.safeParse({ full_name: 'Sam', email: 'nope', message: '' }).success).toBe(false);
  });
});

describe('request emails', () => {
  const data = {
    reference: 'REQ-ABC123',
    contactName: '<b>Pat</b> Lee',
    contactPhone: '818-555-0100',
    contactEmail: 'pat@example.com',
    companyName: null,
    pickupAddress: '100 Main St',
    dropoffAddress: '200 Lab Way',
    itemType: 'Medical',
    itemDescription: null,
    serviceLevel: 'Today',
    pickupDate: null,
    timeWindow: null,
    notes: null,
    saved: true,
  };

  it('escapes customer input in HTML', () => {
    const e = opsNewDeliveryRequest(data);
    expect(e.html).not.toContain('<b>Pat</b>');
    expect(e.html).toContain('&lt;b&gt;Pat&lt;/b&gt;');
    expect(e.subject).toContain('REQ-ABC123');
  });

  it('says when the database copy is missing', () => {
    expect(opsNewDeliveryRequest({ ...data, saved: false }).text).toContain('only copy');
  });

  it('acknowledgement promises no booking or charge', () => {
    expect(customerRequestAcknowledgement(data).text).toContain('Nothing is booked or charged');
  });

  it('contact alert includes the message', () => {
    const e = opsNewContactMessage({ fullName: 'Sam', email: 's@x.com', phone: null, subject: 'Support', message: 'Hello there', saved: true });
    expect(e.text).toContain('Hello there');
  });

  it('application alert lists screening answers', () => {
    const e = opsNewApplicationAlert({
      fullName: 'Ana',
      email: 'a@x.com',
      phone: null,
      answers: [['Cargo van', 'Yes'], ['Experience', '']],
      hasResume: true,
    });
    expect(e.text).toContain('Cargo van:');
    expect(e.text).not.toContain('Experience:');
    expect(e.text).toContain('A resume was attached.');
  });
});

describe('copy is plain ASCII', () => {
  it('no curly quotes or long dashes in request emails', () => {
    const all = [opsNewDeliveryRequest(data()).text, customerRequestAcknowledgement(data()).text].join('');
    expect(/[\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/.test(all)).toBe(false);
  });
});

function data() {
  return {
    reference: 'REQ-1',
    contactName: 'Pat',
    contactPhone: '8185550100',
    contactEmail: 'p@x.com',
    companyName: null,
    pickupAddress: 'a',
    dropoffAddress: 'b',
    itemType: 'Legal',
    itemDescription: null,
    serviceLevel: 'ASAP',
    pickupDate: null,
    timeWindow: null,
    notes: null,
    saved: true,
  };
}
