// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { calculateQuote } from '@epyc/shared';
import { haversineDrivingMiles } from '@/lib/server/distance';

// Session user and the service-role insert are mocked; everything else
// (validation, bounding box, distance, quote) is the real code.
const state: {
  user: { id: string } | null;
  inserted: Array<Record<string, unknown>>;
  insertError: { code?: string; message: string } | null;
} = { user: { id: 'cust-1' }, inserted: [], insertError: null };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock('@/lib/server/driver-session', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        expect(table).toBe('deliveries');
        state.inserted.push(row);
        return {
          select: () => ({
            single: async () =>
              state.insertError
                ? { data: null, error: state.insertError }
                : { data: { id: 'del-1', tracking_number: row.tracking_number }, error: null },
          }),
        };
      },
    }),
  }),
}));

import { POST } from './route';

const PICKUP = { lat: 34.0522, lng: -118.2437 }; // Downtown LA
const DROPOFF = { lat: 34.0195, lng: -118.4912 }; // Santa Monica

let ip = 0;
function req(body: unknown): NextRequest {
  ip += 1;
  return new NextRequest('http://localhost/api/client/deliveries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${ip}` },
    body: JSON.stringify(body),
  });
}

const body = (extra: Record<string, unknown> = {}) => ({
  pickup_address: '1 Main St',
  pickup_city: 'Los Angeles',
  pickup_state: 'CA',
  pickup_zip: '90012',
  pickup_contact_name: 'A',
  pickup_contact_phone: '555',
  pickup_instructions: '',
  pickup_lat: PICKUP.lat,
  pickup_lng: PICKUP.lng,
  delivery_address: '2 Ocean Ave',
  delivery_city: 'Santa Monica',
  delivery_state: 'CA',
  delivery_zip: '90401',
  delivery_contact_name: 'B',
  delivery_contact_phone: '556',
  delivery_instructions: '',
  delivery_lat: DROPOFF.lat,
  delivery_lng: DROPOFF.lng,
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
  vehicle_required: 'car',
  ...extra,
});

function expectedQuote() {
  const miles = Math.round(haversineDrivingMiles(PICKUP, DROPOFF) * 10) / 10;
  return calculateQuote(
    {
      pickup_address: '1 Main St',
      pickup_city: 'Los Angeles',
      pickup_state: 'CA',
      pickup_zip: '90012',
      delivery_address: '2 Ocean Ave',
      delivery_city: 'Santa Monica',
      delivery_state: 'CA',
      delivery_zip: '90401',
      package_weight: 5,
      package_length: 10,
      package_width: 10,
      package_height: 10,
      service_level: 'standard',
      vehicle_required: 'car',
      is_medical: false,
      is_hipaa: false,
      requires_temperature_control: false,
      temperature_min: 2,
      temperature_max: 8,
    },
    miles
  );
}

beforeEach(() => {
  state.user = { id: 'cust-1' };
  state.inserted = [];
  state.insertError = null;
  delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
});

describe('POST /api/client/deliveries', () => {
  it('requires a signed-in user', async () => {
    state.user = null;
    const res = await POST(req(body()));
    expect(res.status).toBe(401);
    expect(state.inserted).toHaveLength(0);
  });

  it('rejects a booking that carries an altered price and writes nothing', async () => {
    const res = await POST(req(body({ total_price: 1, base_price: 0, distance_price: 0 })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/set by the server/);
    expect(state.inserted).toHaveLength(0);
  });

  it('rejects a body that tries to set company, tip, or customer', async () => {
    for (const extra of [{ company_id: 'c' }, { tip_amount: 100 }, { customer_id: 'someone-else' }]) {
      const res = await POST(req(body(extra)));
      expect(res.status).toBe(400);
    }
    expect(state.inserted).toHaveLength(0);
  });

  it('refuses missing coordinates (no 15-mile fallback)', async () => {
    const res = await POST(req(body({ pickup_lat: null, pickup_lng: null })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/suggestions/);
    expect(state.inserted).toHaveLength(0);
  });

  it('refuses coordinates outside the service area', async () => {
    const res = await POST(req(body({ delivery_lat: 40.7128, delivery_lng: -74.006 })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/outside our Southern California service area/);
  });

  it('quote_only returns the server quote and writes nothing', async () => {
    const res = await POST(req(body({ quote_only: true })));
    expect(res.status).toBe(200);
    const json = await res.json();
    const exp = expectedQuote();
    expect(json.quote.total_price).toBe(exp.total_price);
    expect(json.quote).not.toHaveProperty('driver_payout');
    expect(state.inserted).toHaveLength(0);
  });

  it('books at the server price, for the session user, with a server tracking number', async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(201);
    const json = await res.json();
    const exp = expectedQuote();

    expect(state.inserted).toHaveLength(1);
    const row = state.inserted[0];
    expect(row.customer_id).toBe('cust-1');
    expect(row.status).toBe('booked');
    expect(row.total_price).toBe(exp.total_price);
    expect(row.distance_miles).toBe(exp.distance_miles);
    expect(row.base_price).toBe(exp.base_price);
    expect(row).not.toHaveProperty('company_id');
    expect(row).not.toHaveProperty('tip_amount');
    expect(row).not.toHaveProperty('driver_payout');
    expect(String(row.tracking_number)).toMatch(/^EPYC[A-Z0-9]+$/);

    expect(json.id).toBe('del-1');
    expect(json.tracking_number).toBe(row.tracking_number);
    expect(json.quote.total_price).toBe(exp.total_price);
  });

  it('retries once on a tracking number collision, then gives up cleanly', async () => {
    state.insertError = { code: '23505', message: 'duplicate key' };
    const res = await POST(req(body()));
    expect(res.status).toBe(500);
    expect(state.inserted).toHaveLength(2);
  });
});
