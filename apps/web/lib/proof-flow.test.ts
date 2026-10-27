import { describe, it, expect } from 'vitest';
import {
  canDriverMoveTo,
  driverStepFor,
  validatePickupProof,
  buildPickupProofRows,
  validateDropoffProof,
  buildDropoffProofRows,
  proofPhotoPath,
  LEFT_WITHOUT_SIGNATURE_PREFIX,
  NO_RECEIPT_PREFIX,
  pickupChecklist,
  dropoffChecklist,
  type DropoffProofInput,
} from './proof-flow';

describe('canDriverMoveTo (mirrors guard_delivery_driver_update)', () => {
  it('allows the next step and skipping en_route steps', () => {
    expect(canDriverMoveTo('assigned', 'en_route_pickup')).toBe(true);
    expect(canDriverMoveTo('assigned', 'arrived_pickup')).toBe(true);
    expect(canDriverMoveTo('arrived_pickup', 'picked_up')).toBe(true);
    expect(canDriverMoveTo('picked_up', 'arrived_delivery')).toBe(true);
    expect(canDriverMoveTo('arrived_delivery', 'delivered')).toBe(true);
  });

  it('blocks skipping proof steps and moving backward', () => {
    expect(canDriverMoveTo('assigned', 'picked_up')).toBe(false);
    expect(canDriverMoveTo('picked_up', 'delivered')).toBe(false);
    expect(canDriverMoveTo('arrived_delivery', 'picked_up')).toBe(false);
    expect(canDriverMoveTo('booked', 'assigned')).toBe(false);
    expect(canDriverMoveTo('delivered', 'failed')).toBe(false);
  });

  it('allows failed from an active step', () => {
    expect(canDriverMoveTo('en_route_delivery', 'failed')).toBe(true);
  });
});

describe('driverStepFor', () => {
  it('maps statuses to screens', () => {
    expect(driverStepFor('assigned')).toBe('to_pickup');
    expect(driverStepFor('en_route_pickup')).toBe('to_pickup');
    expect(driverStepFor('arrived_pickup')).toBe('pickup_proof');
    expect(driverStepFor('picked_up')).toBe('to_dropoff');
    expect(driverStepFor('arrived_delivery')).toBe('dropoff_proof');
    expect(driverStepFor('delivered')).toBe('done');
  });
});

describe('pickup proof', () => {
  it('requires an item photo and a receipt or a no-receipt note', () => {
    expect(validatePickupProof({ itemPhotos: [], receiptPhotos: ['r'], noReceipt: false, note: '' })).toMatch(/item/);
    expect(validatePickupProof({ itemPhotos: ['a'], receiptPhotos: [], noReceipt: false, note: '' })).toMatch(/receipt/);
    expect(validatePickupProof({ itemPhotos: ['a'], receiptPhotos: [], noReceipt: true, note: '' })).toMatch(/note/);
    expect(validatePickupProof({ itemPhotos: ['a'], receiptPhotos: [], noReceipt: true, note: 'Store had none' })).toBeNull();
    expect(validatePickupProof({ itemPhotos: ['a'], receiptPhotos: ['r'], noReceipt: false, note: '' })).toBeNull();
    expect(
      validatePickupProof({ itemPhotos: ['1', '2', '3', '4', '5'], receiptPhotos: ['r'], noReceipt: false, note: '' })
    ).toMatch(/Up to 4/);
  });

  it('builds pickup rows with stage and kind', () => {
    const rows = buildPickupProofRows(
      'd1',
      { itemPhotos: ['d1/a.jpg', 'd1/b.jpg'], receiptPhotos: ['d1/r.jpg'], noReceipt: false, note: '' },
      { lat: 1, lng: 2 },
      'T'
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.stage === 'pickup' && r.type === 'photo')).toBe(true);
    expect(rows.map((r) => r.photo_kind)).toEqual(['item', 'item', 'receipt']);
    expect(rows[0].lat).toBe(1);
  });

  it('puts the no-receipt note on the first item row and drops receipts', () => {
    const rows = buildPickupProofRows(
      'd1',
      { itemPhotos: ['d1/a.jpg'], receiptPhotos: ['d1/r.jpg'], noReceipt: true, note: 'none given' },
      null,
      'T'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].notes).toBe(`${NO_RECEIPT_PREFIX} none given`);
    expect(rows[0].lat).toBeNull();
  });
});

describe('drop-off proof', () => {
  const base: DropoffProofInput = {
    recipientName: 'Pat',
    leftWith: 'front_desk',
    note: '',
    placementPhotos: ['d1/p.jpg'],
    recipientPhotos: [],
    signature: 'data:image/png;base64,x',
    requiresSignature: true,
    noSignature: false,
  };

  it('validates required fields', () => {
    expect(validateDropoffProof(base)).toBeNull();
    expect(validateDropoffProof({ ...base, recipientName: ' ' })).toMatch(/recipient/);
    expect(validateDropoffProof({ ...base, leftWith: '' })).toMatch(/where/);
    expect(validateDropoffProof({ ...base, placementPhotos: [] })).toMatch(/photo/);
    expect(validateDropoffProof({ ...base, signature: null })).toMatch(/signature/);
    expect(validateDropoffProof({ ...base, signature: null, requiresSignature: false })).toBeNull();
    expect(validateDropoffProof({ ...base, signature: null, noSignature: true })).toMatch(/note/);
    expect(validateDropoffProof({ ...base, signature: null, noSignature: true, note: 'Closed office' })).toBeNull();
  });

  it('builds placement, recipient, and signature rows', () => {
    const rows = buildDropoffProofRows(
      'd1',
      { ...base, recipientPhotos: ['d1/who.jpg'], note: 'Left at desk' },
      { lat: 3, lng: 4 },
      'T'
    );
    expect(rows.map((r) => [r.type, r.photo_kind])).toEqual([
      ['photo', 'placement'],
      ['photo', 'recipient'],
      ['signature', null],
    ]);
    expect(rows.every((r) => r.stage === 'delivery' && r.recipient_relation === 'front_desk')).toBe(true);
    expect(rows[0].notes).toBe('Left at desk');
  });

  it('marks left-without-signature in notes and skips the signature row', () => {
    const rows = buildDropoffProofRows(
      'd1',
      { ...base, noSignature: true, note: 'Nobody available' },
      null,
      'T'
    );
    expect(rows).toHaveLength(1);
    expect(String(rows[0].notes).startsWith(LEFT_WITHOUT_SIGNATURE_PREFIX)).toBe(true);
    // The trigger matches this case-insensitively.
    expect(String(rows[0].notes).toLowerCase().startsWith('left without signature:')).toBe(true);
  });
});

describe('proofPhotoPath', () => {
  it('starts with the delivery id folder', () => {
    expect(proofPhotoPath('abc', 'pickup', 'item', 123)).toMatch(/^abc\/pickup-item-123-[a-z0-9]+\.jpg$/);
  });
});


describe('checklists', () => {
  const done = (items: { done: boolean }[]) => items.map((i) => i.done);
  it('pickup follows status and live photos', () => {
    expect(done(pickupChecklist('assigned'))).toEqual([false, false, false, false]);
    expect(done(pickupChecklist('arrived_pickup', { itemPhotos: 1 }))).toEqual([true, true, false, false]);
    expect(done(pickupChecklist('arrived_pickup', { itemPhotos: 2, receiptOrNote: true }))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(done(pickupChecklist('en_route_delivery'))).toEqual([true, true, true, true]);
  });
  it('drop-off follows status and live proof', () => {
    expect(done(dropoffChecklist('picked_up'))).toEqual([false, false, false, false]);
    expect(done(dropoffChecklist('arrived_delivery', { placementPhotos: 1 }))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(done(dropoffChecklist('delivered'))).toEqual([true, true, true, true]);
  });
});
