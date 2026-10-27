import { describe, it, expect } from 'vitest';
import {
  ALREADY_ASSIGNED_MESSAGE,
  canCustomerCancel,
  chargeCents,
  eventDetail,
  eventHeadline,
  evaluateCustomerCancel,
  formatCents,
  isCustomerVisibleEvent,
  isSafeSignatureData,
  nextPaymentStatus,
  selectCustomerProof,
  type ProofRow,
} from './customer-delivery';

describe('evaluateCustomerCancel', () => {
  const mine = { customer_id: 'u1', status: 'booked', driver_id: null };

  it('allows the owner to cancel a booked job with no driver', () => {
    expect(evaluateCustomerCancel('u1', mine)).toEqual({ ok: true });
  });

  it('allows quote_requested and quoted', () => {
    expect(evaluateCustomerCancel('u1', { ...mine, status: 'quote_requested' }).ok).toBe(true);
    expect(evaluateCustomerCancel('u1', { ...mine, status: 'quoted' }).ok).toBe(true);
  });

  it('hides other customers deliveries as 404', () => {
    expect(evaluateCustomerCancel('u2', mine)).toMatchObject({ ok: false, httpStatus: 404 });
    expect(evaluateCustomerCancel('u1', null)).toMatchObject({ ok: false, httpStatus: 404 });
  });

  it('returns 409 with the dispatch phone once a driver is set', () => {
    expect(evaluateCustomerCancel('u1', { ...mine, driver_id: 'drv-1' })).toEqual({
      ok: false,
      httpStatus: 409,
      error: ALREADY_ASSIGNED_MESSAGE,
    });
    expect(ALREADY_ASSIGNED_MESSAGE).toContain('(818) 217-0070');
  });

  it('returns 409 for in-progress statuses even without a driver id', () => {
    for (const status of ['assigned', 'en_route_pickup', 'picked_up', 'arrived_delivery']) {
      expect(evaluateCustomerCancel('u1', { ...mine, status })).toMatchObject({
        ok: false,
        httpStatus: 409,
        error: ALREADY_ASSIGNED_MESSAGE,
      });
    }
  });

  it('returns 409 for already cancelled or finished jobs', () => {
    expect(evaluateCustomerCancel('u1', { ...mine, status: 'cancelled' })).toMatchObject({
      httpStatus: 409,
      error: 'This delivery is already cancelled.',
    });
    expect(evaluateCustomerCancel('u1', { ...mine, status: 'delivered', driver_id: 'd' })).toMatchObject({
      httpStatus: 409,
      error: 'This delivery is already finished.',
    });
  });
});

describe('canCustomerCancel', () => {
  it('drives the button: only pre-assignment statuses with no driver', () => {
    expect(canCustomerCancel({ status: 'booked', driver_id: null })).toBe(true);
    expect(canCustomerCancel({ status: 'booked', driver_id: 'd' })).toBe(false);
    expect(canCustomerCancel({ status: 'assigned', driver_id: null })).toBe(false);
  });
});

describe('selectCustomerProof', () => {
  const row = (p: Partial<ProofRow>): ProofRow => ({
    type: 'photo',
    stage: 'delivery',
    photo_kind: null,
    photo_url: null,
    signature_data: null,
    recipient_name: null,
    recipient_relation: null,
    notes: null,
    captured_at: '2026-10-28T10:00:00Z',
    ...p,
  });

  const rows: ProofRow[] = [
    row({ stage: 'pickup', photo_kind: 'item', photo_url: 'd/item.jpg' }),
    row({ stage: 'pickup', photo_kind: 'receipt', photo_url: 'd/receipt.jpg', notes: 'BOL 123' }),
    row({ photo_kind: 'placement', photo_url: 'd/place1.jpg', notes: 'Left at front desk', recipient_name: 'Ana' }),
    row({ photo_kind: 'placement', photo_url: 'd/place2.jpg', captured_at: '2026-10-28T10:05:00Z' }),
    row({ photo_kind: 'recipient', photo_url: 'd/face.jpg', recipient_relation: 'Receptionist' }),
    row({ type: 'signature', signature_data: 'data:image/png;base64,AAAA' }),
  ];

  it('returns placement photos only, never recipient or pickup photos', () => {
    const p = selectCustomerProof(rows);
    expect(p.placementPaths).toEqual(['d/place1.jpg', 'd/place2.jpg']);
    expect(p.placementPaths).not.toContain('d/face.jpg');
    expect(p.placementPaths).not.toContain('d/item.jpg');
    expect(p.placementPaths).not.toContain('d/receipt.jpg');
  });

  it('returns the signature, recipient name, delivery notes, and latest time', () => {
    const p = selectCustomerProof(rows);
    expect(p.signatureData).toBe('data:image/png;base64,AAAA');
    expect(p.recipientName).toBe('Ana');
    expect(p.recipientRelation).toBe('Receptionist');
    expect(p.notes).toEqual(['Left at front desk']);
    expect(p.notes).not.toContain('BOL 123');
    expect(p.capturedAt).toBe('2026-10-28T10:05:00Z');
  });

  it('treats legacy rows with no stage as delivery-stage', () => {
    const p = selectCustomerProof([row({ stage: null, photo_kind: 'placement', photo_url: 'x.jpg' })]);
    expect(p.placementPaths).toEqual(['x.jpg']);
  });

  it('is empty for no rows', () => {
    expect(selectCustomerProof([])).toEqual({
      placementPaths: [],
      signatureData: null,
      recipientName: null,
      recipientRelation: null,
      notes: [],
      capturedAt: null,
    });
  });
});

describe('isSafeSignatureData', () => {
  it('accepts inline image data URLs only', () => {
    expect(isSafeSignatureData('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeSignatureData('https://evil.example/x.png')).toBe(false);
    expect(isSafeSignatureData('javascript:alert(1)')).toBe(false);
    expect(isSafeSignatureData('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeSignatureData(null)).toBe(false);
  });
});

describe('timeline events', () => {
  it('builds headlines from event_type', () => {
    expect(eventHeadline({ event_type: 'customer_cancelled' })).toBe('You cancelled this delivery');
    expect(eventHeadline({ event_type: 'payment_received' })).toBe('Payment received');
    expect(eventHeadline({ event_type: 'arrived_pickup' })).toBe('Arrived pickup');
    expect(eventHeadline({ event_type: '' })).toBe('Update');
  });

  it('shows notes only for customer-facing event types', () => {
    expect(eventDetail({ event_type: 'payment_received', notes: 'Payment of $10.00 received' })).toBe(
      'Payment of $10.00 received'
    );
    expect(eventDetail({ event_type: 'status_change', notes: 'internal' })).toBeNull();
    expect(eventDetail({ event_type: 'customer_cancelled', notes: '   ' })).toBeNull();
  });

  it('hides driver problem reports and offer traffic from customers', () => {
    expect(isCustomerVisibleEvent({ event_type: 'exception' })).toBe(false);
    expect(isCustomerVisibleEvent({ event_type: 'offer_sent' })).toBe(false);
    expect(isCustomerVisibleEvent({ event_type: 'driver_released' })).toBe(false);
    expect(isCustomerVisibleEvent({ event_type: 'status_change' })).toBe(true);
    expect(isCustomerVisibleEvent({ event_type: 'customer_cancelled' })).toBe(true);
  });
});

describe('nextPaymentStatus', () => {
  it('writes a first status', () => {
    expect(nextPaymentStatus(null, 'succeeded')).toBe('succeeded');
  });
  it('ignores repeats so retried webhooks log once', () => {
    expect(nextPaymentStatus('succeeded', 'succeeded')).toBeNull();
  });
  it('moves forward', () => {
    expect(nextPaymentStatus('pending', 'succeeded')).toBe('succeeded');
    expect(nextPaymentStatus('pending', 'failed')).toBe('failed');
    expect(nextPaymentStatus('succeeded', 'refunded')).toBe('refunded');
  });
  it('lets a failed attempt be followed by a success or a fresh pending', () => {
    expect(nextPaymentStatus('failed', 'succeeded')).toBe('succeeded');
    expect(nextPaymentStatus('failed', 'pending')).toBe('pending');
  });
  it('never steps back from succeeded or refunded', () => {
    expect(nextPaymentStatus('succeeded', 'failed')).toBeNull();
    expect(nextPaymentStatus('succeeded', 'pending')).toBeNull();
    expect(nextPaymentStatus('refunded', 'succeeded')).toBeNull();
  });
});

describe('chargeCents / formatCents', () => {
  it('converts stored totals to cents', () => {
    expect(chargeCents(42.5)).toBe(4250);
    expect(chargeCents('19.99')).toBe(1999);
    expect(chargeCents(0)).toBeNull();
    expect(chargeCents(null)).toBeNull();
    expect(chargeCents('abc')).toBeNull();
  });
  it('formats cents with plain ASCII', () => {
    expect(formatCents(4250)).toBe('$42.50');
  });
});
