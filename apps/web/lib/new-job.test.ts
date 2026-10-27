import { describe, it, expect } from 'vitest';
import {
  EMPTY_NEW_JOB,
  validateNewJob,
  buildNewJobRow,
  packageDescriptionWithPieces,
  jobSourceLabel,
  type NewJobForm,
} from './new-job';

const validForm: NewJobForm = {
  ...EMPTY_NEW_JOB,
  source: 'curri',
  source_reference: 'CUR-12345',
  pickup_address: '100 Main St',
  pickup_city: 'Los Angeles',
  pickup_state: 'ca',
  pickup_zip: '90012',
  delivery_address: '200 Oak Ave',
  delivery_city: 'Burbank',
  delivery_state: 'CA',
  delivery_zip: '91502',
  package_description: 'Pipe fittings',
  package_weight: '40',
  pieces: '3',
  total_price: '85.00',
  driver_payout: '60',
};

describe('validateNewJob', () => {
  it('accepts a complete form', () => {
    expect(validateNewJob(validForm)).toEqual({});
  });

  it('flags required fields on an empty form', () => {
    const errors = validateNewJob(EMPTY_NEW_JOB);
    expect(errors.pickup_address).toBeDefined();
    expect(errors.delivery_zip).toBeDefined();
    expect(errors.package_description).toBeDefined();
    expect(errors.total_price).toBeDefined();
    expect(errors.driver_payout).toBeDefined();
  });

  it('requires a reference for platform sources but not direct', () => {
    expect(validateNewJob({ ...validForm, source_reference: '' }).source_reference).toBeDefined();
    expect(
      validateNewJob({ ...validForm, source: 'direct', source_reference: '' }).source_reference
    ).toBeUndefined();
  });

  it('rejects a payout above the job price', () => {
    expect(validateNewJob({ ...validForm, driver_payout: '90' }).driver_payout).toBeDefined();
  });

  it('rejects bad ZIP and window order', () => {
    const errors = validateNewJob({
      ...validForm,
      pickup_zip: '9001',
      pickup_window_start: '2026-11-11T10:00',
      pickup_window_end: '2026-11-11T09:00',
    });
    expect(errors.pickup_zip).toBeDefined();
    expect(errors.pickup_window_end).toBeDefined();
  });
});

describe('buildNewJobRow', () => {
  it('builds a booked row owned by the staff user with no HIPAA flags', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    const row = buildNewJobRow(validForm, 'staff-1', 'EPYCTEST', now);
    expect(row.customer_id).toBe('staff-1');
    expect(row.status).toBe('booked');
    expect(row.booked_at).toBe(now.toISOString());
    expect(row.tracking_number).toBe('EPYCTEST');
    expect(row.source).toBe('curri');
    expect(row.source_reference).toBe('CUR-12345');
    expect(row.pickup_state).toBe('CA');
    expect(row.package_description).toBe('Pipe fittings (3 pieces)');
    expect(row.package_weight).toBe(40);
    expect(row.total_price).toBe(85);
    expect(row.driver_payout).toBe(60);
    expect(row.is_hipaa).toBe(false);
    expect(row.is_medical).toBe(false);
    expect(row.requires_signature).toBe(true);
    expect(row.requires_photo_pod).toBe(true);
    expect(row.loading_required).toBe(false);
    expect(row.pickup_window_start).toBeNull();
  });
});

describe('helpers', () => {
  it('folds pieces into the description', () => {
    expect(packageDescriptionWithPieces('Box', '1')).toBe('Box (1 piece)');
    expect(packageDescriptionWithPieces('Box', '')).toBe('Box');
  });

  it('labels sources', () => {
    expect(jobSourceLabel('walmart_spark')).toBe('Walmart Spark');
    expect(jobSourceLabel(null)).toBe('Direct');
  });
});
