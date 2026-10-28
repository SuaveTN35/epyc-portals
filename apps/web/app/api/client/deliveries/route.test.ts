// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { calculateQuote } from '@epyc/shared';
import { haversineDrivingMiles } from '@/lib/server/distance';

// Session user, the service-role insert, and the network (fetch) are
// mocked; everything else (validation, geocoding, bounding box, distance,
// quote) is the real code.
const state: {
  user: { id: string } | null;
  inserted: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  insertError: { code?: string; message: string } | null;
} = { user: { id: 'cust-1' }, inserted: [], events: [], insertError: null };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock('@/lib/server/driver-session', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === 'delivery_events') {
          state.events.push(row);
          return Promise.resolve({ error: null });
        }
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

function expectedQuote(a = PICKUP, b = DROPOFF) {
  const miles = Math.round(haversineDrivingMiles(a, b) * 10) / 10;
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

// ---- network mock: Google Geocoding / Distance Matrix and the Census geocoder.
// Keys are lower-case street fragments of the address text.
const net: {
  census: 'ok' | 'down';
  google: 'ok' | 'denied';
  points: Record<string, { lat: number; lng: number } | null>;
  calls: string[];
} = { census: 'ok', google: 'ok', points: {}, calls: [] };

function pointFor(address: string) {
  const a = address.toLowerCase();
  const key = Object.keys(net.points).find((k) => a.includes(k));
  return key ? net.points[key] : null;
}

const fetchMock = vi.fn(async (input: string | URL) => {
  const url = new URL(String(input));
  net.calls.push(url.hostname + url.pathname);
  const json = (body: unknown, ok = true) =>
    ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response;
  if (url.hostname === 'geocoding.geo.census.gov') {
    if (net.census === 'down') throw new Error('timeout');
    const p = pointFor(url.searchParams.get('address') ?? '');
    return json({ result: { addressMatches: p ? [{ coordinates: { x: p.lng, y: p.lat } }] : [] } });
  }
  if (url.pathname.endsWith('/geocode/json')) {
    if (net.google === 'denied') {
      return json({ status: 'REQUEST_DENIED', error_message: 'API keys with referer restrictions cannot be used with this API.' });
    }
    const p = pointFor(url.searchParams.get('address') ?? '');
    return json(
      p
        ? { status: 'OK', results: [{ geometry: { location: p, location_type: 'ROOFTOP' } }] }
        : { status: 'ZERO_RESULTS', results: [] }
    );
  }
  if (url.pathname.endsWith('/distancematrix/json')) {
    // Force the haversine fallback so expected miles are easy to compute.
    return json({ status: 'REQUEST_DENIED', error_message: 'denied' });
  }
  throw new Error(`unexpected fetch ${url.hostname}`);
});

beforeEach(() => {
  state.user = { id: 'cust-1' };
  state.inserted = [];
  state.events = [];
  state.insertError = null;
  net.census = 'ok';
  net.google = 'ok';
  net.calls = [];
  net.points = { '1 main st': PICKUP, '2 ocean ave': DROPOFF };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
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
  it('records the price source on the job event trail, without addresses', async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(201);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ delivery_id: 'del-1', event_type: 'priced' });
    const note = String(state.events[0].notes);
    expect(note).toMatch(/Distance: haversine/);
    expect(note).toMatch(/Geocode: pickup census, delivery census/);
    expect(note).not.toMatch(/Main|Ocean/);
  });
});

// P-362: price from the address text, not from coordinates the browser sends.
describe('POST /api/client/deliveries distance integrity (P-362)', () => {
  // Real addresses about 60 road miles apart.
  const LANCASTER = { lat: 34.6868, lng: -118.1542 };
  const LONG_BEACH = { lat: 33.7701, lng: -118.1937 };
  const farBody = (extra: Record<string, unknown> = {}) =>
    body({
      pickup_address: '44933 Fern Ave',
      pickup_city: 'Lancaster',
      pickup_zip: '93534',
      delivery_address: '411 W Ocean Blvd',
      delivery_city: 'Long Beach',
      delivery_zip: '90802',
      // Forged: two nearly identical points in downtown LA.
      pickup_lat: 34.0522,
      pickup_lng: -118.2437,
      delivery_lat: 34.0523,
      delivery_lng: -118.2436,
      ...extra,
    });
  const farQuote = () => {
    const q = expectedQuote(LANCASTER, LONG_BEACH);
    return q;
  };

  beforeEach(() => {
    net.points = { '44933 fern ave': LANCASTER, '411 w ocean blvd': LONG_BEACH, ...net.points };
  });

  it('far-apart addresses with near-identical coordinates are priced at the true distance', async () => {
    const res = await POST(req(farBody()));
    expect(res.status).toBe(201);
    const exp = farQuote();
    expect(exp.distance_miles).toBeGreaterThan(70); // haversine x 1.3 of ~64 straight miles
    const row = state.inserted[0];
    expect(row.distance_miles).toBe(exp.distance_miles);
    expect(row.total_price).toBe(exp.total_price);
    // The forged near-zero trip would have been far cheaper.
    const forged = expectedQuote({ lat: 34.0522, lng: -118.2437 }, { lat: 34.0523, lng: -118.2436 });
    expect(Number(row.total_price)).toBeGreaterThan(Number(forged.total_price));
    // Stored points are the server geocodes, not the browser's.
    expect(row.pickup_lat).toBe(LANCASTER.lat);
    expect(row.pickup_lng).toBe(LANCASTER.lng);
    expect(row.delivery_lat).toBe(LONG_BEACH.lat);
    expect(row.delivery_lng).toBe(LONG_BEACH.lng);
    expect(String(state.events[0].notes)).toMatch(/did not match the address/);
  });

  it('quote_only uses the same geocode and pricing as the booking', async () => {
    const res = await POST(req(farBody({ quote_only: true })));
    expect(res.status).toBe(200);
    expect((await res.json()).quote.total_price).toBe(farQuote().total_price);
    expect(state.inserted).toHaveLength(0);
  });

  it('browser coordinates within a mile of the geocode are fine', async () => {
    const res = await POST(
      req(body({ pickup_lat: PICKUP.lat + 0.005, delivery_lng: DROPOFF.lng + 0.005 }))
    );
    expect(res.status).toBe(201);
    const row = state.inserted[0];
    expect(row.total_price).toBe(expectedQuote().total_price);
    expect(row.pickup_lat).toBe(PICKUP.lat);
    expect(String(state.events[0].notes)).not.toMatch(/did not match/);
  });

  it('Google geocoding fails (REQUEST_DENIED) and Census prices the job', async () => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = 'test-key';
    net.google = 'denied';
    const res = await POST(req(farBody()));
    expect(res.status).toBe(201);
    expect(state.inserted[0].total_price).toBe(farQuote().total_price);
    expect(net.calls.some((c) => c.includes('/geocode/json'))).toBe(true);
    expect(net.calls.some((c) => c.startsWith('geocoding.geo.census.gov'))).toBe(true);
    expect(String(state.events[0].notes)).toMatch(/pickup census, delivery census/);
  });

  it('Google geocoding works: Google points price the job', async () => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = 'test-key';
    const res = await POST(req(farBody()));
    expect(res.status).toBe(201);
    expect(state.inserted[0].total_price).toBe(farQuote().total_price);
    expect(String(state.events[0].notes)).toMatch(/pickup google, delivery google/);
  });

  it('both geocoders down: 503, nothing priced or written, no client-coordinate fallback', async () => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = 'test-key';
    net.google = 'denied';
    net.census = 'down';
    for (const extra of [{}, { quote_only: true }]) {
      const res = await POST(req(farBody(extra)));
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toMatch(/call us/);
      expect(json).not.toHaveProperty('quote');
    }
    expect(state.inserted).toHaveLength(0);
  });

  it('address not found by any geocoder: 400 asking to check the address', async () => {
    net.points = { '2 ocean ave': DROPOFF };
    const res = await POST(req(body()));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/could not find the pickup address/);
    expect(json).not.toHaveProperty('quote');
    expect(state.inserted).toHaveLength(0);
  });

  it('refuses an address that geocodes outside the service area, even with in-area coordinates', async () => {
    net.points['2 ocean ave'] = { lat: 40.7128, lng: -74.006 }; // geocodes to New York
    const res = await POST(req(body()));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/delivery address is outside/);
    expect(state.inserted).toHaveLength(0);
  });
});
