// Customer booking, server side (POST /api/client/deliveries, P-358).
// The browser sends the form and the two picked coordinates; the server
// sanity-checks them here, then (P-362, lib/server/booking-route.ts)
// geocodes the address text itself, prices the distance between the server
// points (lib/server/distance.ts, calculateQuote), and inserts with the
// service role. The browser coordinates are a hint, never the price basis. Nothing in the
// request body is trusted for price, customer, status, or tracking number.
//
// buildCustomerBookingRow writes only live columns
// (packages/supabase/LIVE-SCHEMA-SNAPSHOT-2026-10-27.md). driver_payout is
// not sent: dispatch sets it when offering the job. company_id and
// tip_amount are not sent either (column defaults NULL and 0). Payment state
// lives in the payments table.

import { calculateQuote } from '@epyc/shared';
import type { QuoteRequest } from '@epyc/shared';
import {
  BOOKING_FORBIDDEN_FIELDS,
  customerBookingSchema,
  type CustomerBookingRequest,
} from '@/lib/validations';

export interface BookingForm {
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  delivery_instructions: string;
  package_description: string;
  package_weight: number | string;
  package_length: number | string;
  package_width: number | string;
  package_height: number | string;
  requires_signature: boolean;
  is_fragile: boolean;
  is_medical: boolean;
  is_hipaa: boolean;
  requires_temperature_control: boolean;
  temperature_min: number | string;
  temperature_max: number | string;
  service_level: string;
}

export interface BookingQuote {
  distance_miles: number;
  estimated_duration_minutes: number;
  base_price: number;
  distance_price: number;
  weight_surcharge: number;
  rush_surcharge: number;
  hipaa_surcharge: number;
  temperature_surcharge: number;
  total_price: number;
  vehicle_required: string;
}

export interface Coords {
  lat: number;
  lng: number;
}

export function buildCustomerBookingRow(args: {
  customerId: string;
  trackingNumber: string;
  form: BookingForm;
  quote: BookingQuote;
  pickup: Coords | null;
  dropoff: Coords | null;
  now?: Date;
}): Record<string, unknown> {
  const { customerId, trackingNumber, form, quote, pickup, dropoff } = args;
  const now = args.now ?? new Date();
  return {
    tracking_number: trackingNumber,
    customer_id: customerId,
    status: 'booked',
    booked_at: now.toISOString(),
    // Pickup
    pickup_address: form.pickup_address,
    pickup_city: form.pickup_city,
    pickup_state: form.pickup_state,
    pickup_zip: form.pickup_zip,
    pickup_lat: pickup?.lat ?? null,
    pickup_lng: pickup?.lng ?? null,
    pickup_contact_name: form.pickup_contact_name,
    pickup_contact_phone: form.pickup_contact_phone,
    pickup_instructions: form.pickup_instructions,
    // Delivery
    delivery_address: form.delivery_address,
    delivery_city: form.delivery_city,
    delivery_state: form.delivery_state,
    delivery_zip: form.delivery_zip,
    delivery_lat: dropoff?.lat ?? null,
    delivery_lng: dropoff?.lng ?? null,
    delivery_contact_name: form.delivery_contact_name,
    delivery_contact_phone: form.delivery_contact_phone,
    delivery_instructions: form.delivery_instructions,
    // Package
    package_description: form.package_description,
    package_weight: form.package_weight,
    package_length: form.package_length,
    package_width: form.package_width,
    package_height: form.package_height,
    requires_signature: form.requires_signature,
    is_fragile: form.is_fragile,
    is_medical: form.is_medical,
    is_hipaa: form.is_hipaa,
    requires_temperature_control: form.requires_temperature_control,
    temperature_min: form.requires_temperature_control ? form.temperature_min : null,
    temperature_max: form.requires_temperature_control ? form.temperature_max : null,
    // Pricing (server quote, copied unchanged)
    distance_miles: quote.distance_miles,
    estimated_duration_minutes: quote.estimated_duration_minutes,
    base_price: quote.base_price,
    distance_price: quote.distance_price,
    weight_surcharge: quote.weight_surcharge,
    rush_surcharge: quote.rush_surcharge,
    hipaa_surcharge: quote.hipaa_surcharge,
    temperature_surcharge: quote.temperature_surcharge,
    total_price: quote.total_price,
    // Service
    service_level: form.service_level,
    vehicle_required: quote.vehicle_required,
  };
}

// ---------------------------------------------------------------- service area

/**
 * Southern California service bounding box. Covers Los Angeles, Orange,
 * Ventura, San Bernardino, and Riverside counties:
 *   south 33.30  (San Clemente / Temecula; includes Catalina)
 *   north 35.82  (northern tip of San Bernardino County)
 *   west -119.65 (western edge of Ventura County, Rincon)
 *   east -114.13 (Colorado River, San Bernardino / Riverside east line)
 * A box is coarse on purpose: it also admits slivers of Kern, northern San
 * Diego, and Santa Barbara counties. It exists to stop absurd or forged
 * coordinates (other states, 0,0, oceans far offshore), not to draw the
 * exact service map. Dispatch still reviews every job.
 */
export const SERVICE_AREA_BOUNDS = {
  minLat: 33.3,
  maxLat: 35.82,
  minLng: -119.65,
  maxLng: -114.13,
} as const;

export function isInServiceArea(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= SERVICE_AREA_BOUNDS.minLat &&
    lat <= SERVICE_AREA_BOUNDS.maxLat &&
    lng >= SERVICE_AREA_BOUNDS.minLng &&
    lng <= SERVICE_AREA_BOUNDS.maxLng
  );
}

export const PICK_FROM_SUGGESTIONS_MESSAGE =
  'Pick the address from the suggestions list so we can price the route.';

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export type CoordinateCheck =
  | { ok: true; pickup: Coords; dropoff: Coords }
  | { ok: false; error: string };

/** Missing, non-finite, or out-of-area coordinates are refused. No fallback distance. */
export function checkBookingCoordinates(body: {
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
}): CoordinateCheck {
  const { pickup_lat, pickup_lng, delivery_lat, delivery_lng } = body;
  if (!finite(pickup_lat) || !finite(pickup_lng)) {
    return { ok: false, error: `Pickup address: ${PICK_FROM_SUGGESTIONS_MESSAGE}` };
  }
  if (!finite(delivery_lat) || !finite(delivery_lng)) {
    return { ok: false, error: `Delivery address: ${PICK_FROM_SUGGESTIONS_MESSAGE}` };
  }
  if (!isInServiceArea(pickup_lat, pickup_lng)) {
    return { ok: false, error: 'The pickup address is outside our Southern California service area.' };
  }
  if (!isInServiceArea(delivery_lat, delivery_lng)) {
    return { ok: false, error: 'The delivery address is outside our Southern California service area.' };
  }
  return {
    ok: true,
    pickup: { lat: pickup_lat, lng: pickup_lng },
    dropoff: { lat: delivery_lat, lng: delivery_lng },
  };
}

// ---------------------------------------------------------------- request

/** Keys the browser must never send. Returns the ones present. */
export function findForbiddenBookingFields(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const keys = new Set(Object.keys(raw as Record<string, unknown>));
  return BOOKING_FORBIDDEN_FIELDS.filter((k) => keys.has(k));
}

export type ParsedBooking =
  | { ok: true; body: CustomerBookingRequest; pickup: Coords; dropoff: Coords }
  | { ok: false; httpStatus: 400; error: string; details?: Array<{ field: string; message: string }> };

export function parseBookingRequest(raw: unknown): ParsedBooking {
  const forbidden = findForbiddenBookingFields(raw);
  if (forbidden.length > 0) {
    return {
      ok: false,
      httpStatus: 400,
      error: `Price and booking fields are set by the server and must not be sent: ${forbidden.join(', ')}`,
    };
  }
  const parsed = customerBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'Invalid booking request',
      details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    };
  }
  const coords = checkBookingCoordinates(parsed.data);
  if (!coords.ok) return { ok: false, httpStatus: 400, error: coords.error };
  return { ok: true, body: parsed.data, pickup: coords.pickup, dropoff: coords.dropoff };
}

// ---------------------------------------------------------------- quote

export type ServerQuote = ReturnType<typeof calculateQuote>;
/** What the customer sees: the server quote without the driver payout. */
export type CustomerQuote = Omit<ServerQuote, 'driver_payout'>;

export function quoteForBooking(body: CustomerBookingRequest, distanceMiles: number): ServerQuote {
  const request: QuoteRequest = {
    pickup_address: body.pickup_address,
    pickup_city: body.pickup_city,
    pickup_state: body.pickup_state,
    pickup_zip: body.pickup_zip,
    delivery_address: body.delivery_address,
    delivery_city: body.delivery_city,
    delivery_state: body.delivery_state,
    delivery_zip: body.delivery_zip,
    package_weight: body.package_weight,
    package_length: body.package_length,
    package_width: body.package_width,
    package_height: body.package_height,
    service_level: body.service_level,
    vehicle_required: body.vehicle_required,
    is_medical: body.is_medical,
    is_hipaa: body.is_hipaa,
    requires_temperature_control: body.requires_temperature_control,
    temperature_min: body.temperature_min,
    temperature_max: body.temperature_max,
  };
  return calculateQuote(request, distanceMiles);
}

export function toCustomerQuote(quote: ServerQuote): CustomerQuote {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { driver_payout, ...rest } = quote;
  return rest;
}
