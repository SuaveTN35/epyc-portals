import { describe, it, expect } from 'vitest';
import { calculateQuote } from '@epyc/shared';
import {
  buildCustomerBookingRow,
  checkBookingCoordinates,
  findForbiddenBookingFields,
  isInServiceArea,
  parseBookingRequest,
  quoteForBooking,
  toCustomerQuote,
  SERVICE_AREA_BOUNDS,
  type BookingForm,
  type BookingQuote,
} from './customer-booking';

// deliveries columns from packages/supabase/LIVE-SCHEMA-SNAPSHOT-2026-10-27.md
// plus Phase 2 (source, source_reference, loading_required).
const LIVE_DELIVERY_COLUMNS = new Set(
  `id tracking_number customer_id company_id driver_id status
   pickup_address pickup_city pickup_state pickup_zip pickup_lat pickup_lng
   pickup_contact_name pickup_contact_phone pickup_instructions
   pickup_window_start pickup_window_end actual_pickup_time
   delivery_address delivery_city delivery_state delivery_zip delivery_lat delivery_lng
   delivery_contact_name delivery_contact_phone delivery_instructions
   delivery_window_start delivery_window_end actual_delivery_time
   package_description package_weight package_length package_width package_height
   requires_signature requires_photo_pod is_fragile is_medical is_hipaa
   requires_temperature_control temperature_min temperature_max
   distance_miles estimated_duration_minutes base_price distance_price
   weight_surcharge rush_surcharge hipaa_surcharge temperature_surcharge
   total_price driver_payout tip_amount service_level vehicle_required
   quoted_at booked_at assigned_at created_at updated_at
   source source_reference loading_required`.split(/\s+/)
);

const form: BookingForm = {
  pickup_address: '1 Main St',
  pickup_city: 'Los Angeles',
  pickup_state: 'CA',
  pickup_zip: '90001',
  pickup_contact_name: 'A',
  pickup_contact_phone: '555',
  pickup_instructions: '',
  delivery_address: '2 Main St',
  delivery_city: 'Los Angeles',
  delivery_state: 'CA',
  delivery_zip: '90002',
  delivery_contact_name: 'B',
  delivery_contact_phone: '556',
  delivery_instructions: 'Front desk',
  package_description: 'Box',
  package_weight: 5,
  package_length: 10,
  package_width: 10,
  package_height: 10,
  requires_signature: true,
  is_fragile: false,
  is_medical: false,
  is_hipaa: false,
  requires_temperature_control: false,
  temperature_min: 2,
  temperature_max: 8,
  service_level: 'standard',
};

const quote: BookingQuote & { driver_payout: number } = {
  distance_miles: 12.3,
  estimated_duration_minutes: 30,
  base_price: 25,
  distance_price: 18.45,
  weight_surcharge: 0,
  rush_surcharge: 0,
  hipaa_surcharge: 0,
  temperature_surcharge: 0,
  total_price: 43.45,
  vehicle_required: 'car',
  driver_payout: 30,
};

const now = new Date('2026-10-28T12:00:00Z');

describe('buildCustomerBookingRow', () => {
  const row = buildCustomerBookingRow({
    customerId: 'u1',
    trackingNumber: 'EPYCABC123',
    form,
    quote,
    pickup: { lat: 34, lng: -118 },
    dropoff: null,
    now,
  });

  it('writes only live deliveries columns', () => {
    const unknown = Object.keys(row).filter((k) => !LIVE_DELIVERY_COLUMNS.has(k));
    expect(unknown).toEqual([]);
  });

  it('never sends payment_status or driver fields', () => {
    expect(row).not.toHaveProperty('payment_status');
    expect(row).not.toHaveProperty('driver_payout');
    expect(row).not.toHaveProperty('driver_id');
    expect(row).not.toHaveProperty('assigned_at');
  });

  it('books with status, booked_at, tracking number, and the customer id', () => {
    expect(row.status).toBe('booked');
    expect(row.booked_at).toBe('2026-10-28T12:00:00.000Z');
    expect(row.tracking_number).toBe('EPYCABC123');
    expect(row.customer_id).toBe('u1');
  });

  it('copies the (server) quote pricing unchanged', () => {
    expect(row.total_price).toBe(43.45);
    expect(row.distance_price).toBe(18.45);
    expect(row.base_price).toBe(25);
    expect(row.vehicle_required).toBe('car');
  });

  it('nulls missing coordinates and temperature range when not needed', () => {
    expect(row.pickup_lat).toBe(34);
    expect(row.delivery_lat).toBeNull();
    expect(row.temperature_min).toBeNull();
    expect(row.temperature_max).toBeNull();
  });
});

// ---------------------------------------------------------------- P-358

const DOWNTOWN_LA = { lat: 34.0522, lng: -118.2437 };
const SANTA_MONICA = { lat: 34.0195, lng: -118.4912 };

const validBody = () => ({
  ...form,
  pickup_lat: DOWNTOWN_LA.lat,
  pickup_lng: DOWNTOWN_LA.lng,
  delivery_lat: SANTA_MONICA.lat,
  delivery_lng: SANTA_MONICA.lng,
  vehicle_required: 'car',
});

describe('service area bounding box', () => {
  it.each([
    ['Downtown Los Angeles', 34.0522, -118.2437],
    ['Irvine (Orange)', 33.6846, -117.8265],
    ['Ventura', 34.2746, -119.229],
    ['San Bernardino', 34.1083, -117.2898],
    ['Riverside', 33.9806, -117.3755],
    ['Palm Springs (Riverside)', 33.8303, -116.5453],
    ['Lancaster (LA)', 34.6868, -118.1542],
    ['Needles (San Bernardino, east edge)', 34.8481, -114.6141],
  ])('accepts %s', (_name, lat, lng) => {
    expect(isInServiceArea(lat, lng)).toBe(true);
  });

  it.each([
    ['San Francisco', 37.7749, -122.4194],
    ['San Diego downtown', 32.7157, -117.1611],
    ['Las Vegas', 36.1699, -115.1398],
    ['Phoenix', 33.4484, -112.074],
    ['Null Island', 0, 0],
    ['Santa Barbara', 34.4208, -119.6982],
  ])('rejects %s', (_name, lat, lng) => {
    expect(isInServiceArea(lat, lng)).toBe(false);
  });

  it('rejects non-finite values and accepts the exact edges', () => {
    expect(isInServiceArea(Number.NaN, -118)).toBe(false);
    expect(isInServiceArea(34, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isInServiceArea(SERVICE_AREA_BOUNDS.minLat, SERVICE_AREA_BOUNDS.minLng)).toBe(true);
    expect(isInServiceArea(SERVICE_AREA_BOUNDS.maxLat, SERVICE_AREA_BOUNDS.maxLng)).toBe(true);
  });
});

describe('checkBookingCoordinates', () => {
  it('requires both points and asks the customer to pick from suggestions', () => {
    const r1 = checkBookingCoordinates({ delivery_lat: 34, delivery_lng: -118 });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toMatch(/^Pickup address: Pick the address from the suggestions/);
    const r2 = checkBookingCoordinates({ pickup_lat: 34, pickup_lng: -118, delivery_lat: null, delivery_lng: -118 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/^Delivery address:/);
  });

  it('rejects out-of-area points', () => {
    const r = checkBookingCoordinates({ pickup_lat: 34, pickup_lng: -118, delivery_lat: 40.7, delivery_lng: -74 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/delivery address is outside/);
  });

  it('returns both points when valid', () => {
    const r = checkBookingCoordinates(validBody());
    expect(r).toEqual({ ok: true, pickup: DOWNTOWN_LA, dropoff: SANTA_MONICA });
  });
});

describe('parseBookingRequest', () => {
  it('accepts a clean booking body', () => {
    const r = parseBookingRequest(validBody());
    expect(r.ok).toBe(true);
  });

  it.each([
    'total_price',
    'base_price',
    'distance_price',
    'rush_surcharge',
    'driver_payout',
    'tip_amount',
    'company_id',
    'customer_id',
    'status',
    'tracking_number',
    'distance_miles',
    'amount',
  ])('rejects a body that carries %s', (field) => {
    const r = parseBookingRequest({ ...validBody(), [field]: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.httpStatus).toBe(400);
      expect(r.error).toContain(field);
    }
  });

  it('rejects unknown keys (strict schema)', () => {
    const r = parseBookingRequest({ ...validBody(), discount: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Invalid booking request');
  });

  it('rejects missing coordinates with the pick-from-suggestions message (no 15-mile fallback)', () => {
    const body: Record<string, unknown> = validBody();
    delete body.pickup_lat;
    delete body.pickup_lng;
    const r = parseBookingRequest(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/suggestions/);
  });

  it('rejects non-numeric coordinates and an invalid service level', () => {
    expect(parseBookingRequest({ ...validBody(), pickup_lat: '34' }).ok).toBe(false);
    expect(parseBookingRequest({ ...validBody(), service_level: 'free' }).ok).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(parseBookingRequest(null).ok).toBe(false);
    expect(parseBookingRequest([1, 2]).ok).toBe(false);
    expect(findForbiddenBookingFields('total_price')).toEqual([]);
  });
});

describe('quoteForBooking', () => {
  it('equals calculateQuote for the same inputs (pricing math untouched)', () => {
    const r = parseBookingRequest({ ...validBody(), service_level: 'rush', is_hipaa: true, package_weight: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const q = quoteForBooking(r.body, 12.3);
    const expected = calculateQuote(
      {
        pickup_address: form.pickup_address,
        pickup_city: form.pickup_city,
        pickup_state: form.pickup_state,
        pickup_zip: form.pickup_zip,
        delivery_address: form.delivery_address,
        delivery_city: form.delivery_city,
        delivery_state: form.delivery_state,
        delivery_zip: form.delivery_zip,
        package_weight: 80,
        package_length: 10,
        package_width: 10,
        package_height: 10,
        service_level: 'rush',
        vehicle_required: 'car',
        is_medical: false,
        is_hipaa: true,
        requires_temperature_control: false,
        temperature_min: 2,
        temperature_max: 8,
      },
      12.3
    );
    expect(q).toEqual(expected);
    expect(q.total_price).toBeGreaterThan(0);
  });

  it('toCustomerQuote hides the driver payout', () => {
    const r = parseBookingRequest(validBody());
    if (!r.ok) throw new Error('expected ok');
    const cq = toCustomerQuote(quoteForBooking(r.body, 10));
    expect(cq).not.toHaveProperty('driver_payout');
    expect(cq.total_price).toBeGreaterThan(0);
  });
});
