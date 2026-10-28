// Booking route resolution (P-362). Turns a parsed booking into the two
// points the job is priced and stored from.
//
// The browser's picked coordinates are a hint only. Both ends are geocoded
// on the server from the address TEXT (lib/server/geocode.ts), because the
// driver drives to that text. The server points must sit in the service
// area; the distance is computed between them; and they are what gets
// stored in pickup_lat/lng and delivery_lat/lng. If the browser point is
// more than MAX_COORD_MISMATCH_MILES from the server point, the browser
// point is ignored (repriced silently) and the mismatch is logged.
// If an address cannot be geocoded at all, nothing is priced: the browser
// coordinates are never used as a fallback.

import { isInServiceArea, type Coords } from '@/lib/customer-booking';
import type { CustomerBookingRequest } from '@/lib/validations';
import {
  computeRouteDistance,
  straightLineMiles,
  type DistanceOptions,
  type RouteDistance,
} from './distance';
import { geocodeAddress, type GeocodeOptions, type GeocodeSource } from './geocode';

/** Browser point farther than this from the server geocode is not trusted. */
export const MAX_COORD_MISMATCH_MILES = 1;

export const EPYC_PHONE_DISPLAY = '(818) 217-0070';

export interface PriceSource {
  pickup_geocode: GeocodeSource;
  delivery_geocode: GeocodeSource;
  distance: RouteDistance['source'];
  /** Straight-line miles from the browser point to the server point. */
  pickup_offset_miles: number;
  delivery_offset_miles: number;
  browser_coords_replaced: boolean;
}

export type ResolvedRoute =
  | {
      ok: true;
      pickup: Coords;
      dropoff: Coords;
      route: RouteDistance;
      priceSource: PriceSource;
    }
  | { ok: false; httpStatus: 400 | 503; error: string };

export interface ResolveOptions {
  geocode?: GeocodeOptions;
  distance?: DistanceOptions;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Throws RouteNotFoundError (from computeRouteDistance) when Google answers
 * with no driving route; every other failure comes back as { ok: false }.
 */
export async function resolveBookingRoute(
  body: CustomerBookingRequest,
  browserPickup: Coords,
  browserDropoff: Coords,
  opts: ResolveOptions = {}
): Promise<ResolvedRoute> {
  const [pickupGeo, dropoffGeo] = await Promise.all([
    geocodeAddress(
      {
        street: body.pickup_address,
        city: body.pickup_city,
        state: body.pickup_state,
        zip: body.pickup_zip,
      },
      opts.geocode
    ),
    geocodeAddress(
      {
        street: body.delivery_address,
        city: body.delivery_city,
        state: body.delivery_state,
        zip: body.delivery_zip,
      },
      opts.geocode
    ),
  ]);

  for (const [label, geo] of [
    ['pickup', pickupGeo],
    ['delivery', dropoffGeo],
  ] as const) {
    if (geo.ok) continue;
    if (geo.reason === 'no_match') {
      return {
        ok: false,
        httpStatus: 400,
        error: `We could not find the ${label} address. Check the street, city, and ZIP, or call us at ${EPYC_PHONE_DISPLAY}.`,
      };
    }
    return {
      ok: false,
      httpStatus: 503,
      error: `We could not confirm the ${label} address right now. Try again in a minute, or call us at ${EPYC_PHONE_DISPLAY}.`,
    };
  }
  // Both ok past this point.
  const p = (pickupGeo as Extract<typeof pickupGeo, { ok: true }>).point;
  const d = (dropoffGeo as Extract<typeof dropoffGeo, { ok: true }>).point;

  if (!isInServiceArea(p.lat, p.lng)) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'The pickup address is outside our Southern California service area.',
    };
  }
  if (!isInServiceArea(d.lat, d.lng)) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'The delivery address is outside our Southern California service area.',
    };
  }

  const pickup: Coords = { lat: p.lat, lng: p.lng };
  const dropoff: Coords = { lat: d.lat, lng: d.lng };
  const pickupOffset = straightLineMiles(browserPickup, pickup);
  const deliveryOffset = straightLineMiles(browserDropoff, dropoff);

  const route = await computeRouteDistance(pickup, dropoff, opts.distance);

  return {
    ok: true,
    pickup,
    dropoff,
    route,
    priceSource: {
      pickup_geocode: p.source,
      delivery_geocode: d.source,
      distance: route.source,
      pickup_offset_miles: round2(pickupOffset),
      delivery_offset_miles: round2(deliveryOffset),
      browser_coords_replaced:
        pickupOffset > MAX_COORD_MISMATCH_MILES || deliveryOffset > MAX_COORD_MISMATCH_MILES,
    },
  };
}

/** One line for delivery_events.notes. No addresses, no coordinates. */
export function priceSourceNote(s: PriceSource): string {
  const parts = [
    `Server priced. Distance: ${s.distance}.`,
    `Geocode: pickup ${s.pickup_geocode}, delivery ${s.delivery_geocode}.`,
  ];
  if (s.browser_coords_replaced) {
    parts.push(
      `Browser coordinates did not match the address (pickup off ${s.pickup_offset_miles} mi, delivery off ${s.delivery_offset_miles} mi); priced from the address.`
    );
  }
  return parts.join(' ');
}
