import { describe, it, expect } from 'vitest';
import { buildCustomerBookingRow, type BookingForm, type BookingQuote } from './customer-booking';

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

  it('copies quote pricing unchanged', () => {
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
