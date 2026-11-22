'use client';

// Dispatch delivery detail: the route the driver's phone shared for this job.
// Shows how many location updates came in, the miles driven between them, when
// the last one arrived, and a map with the trail. Polls every 30 seconds while
// the job is live. Every fact on the map is also in text, so the card works
// without the map and with a screen reader.

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Route } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useGoogleMaps } from '@/lib/hooks/useGoogleMaps';
import {
  isLiveTrackingStatus,
  locationAgeLabel,
  mapsLink,
  milesLabel,
  routeSummary,
  type LatLng,
  type RouteSummary,
} from '@/lib/live-location';

const POLL_MS = 30_000;

export function DeliveryRouteCard({
  deliveryId,
  status,
  pickup,
  dropoff,
}: {
  deliveryId: string;
  status: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
}) {
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const live = isLiveTrackingStatus(status);

  const load = useCallback(async () => {
    try {
      const { data, error } = await createClient()
        .from('driver_locations')
        .select('lat, lng, recorded_at')
        .eq('delivery_id', deliveryId)
        .order('recorded_at', { ascending: true })
        .limit(2000);
      if (error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setRoute(routeSummary((data ?? []) as { lat: number; lng: number; recorded_at: string | null }[]));
      setNowMs(Date.now());
    } catch {
      setFailed(true);
    }
  }, [deliveryId]);

  useEffect(() => {
    void load();
    if (!live) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [live, load]);

  const last = route?.points[route.points.length - 1] ?? null;

  return (
    <section
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      aria-labelledby={`route-heading-${deliveryId}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Route className="h-5 w-5 text-gray-600" aria-hidden="true" />
        <h2 id={`route-heading-${deliveryId}`} className="text-lg font-semibold text-gray-900">
          Driver route
        </h2>
      </div>

      {route === null && !failed && <p className="text-sm text-gray-700">Loading the route...</p>}
      {failed && (
        <p className="text-sm text-gray-700" role="status">
          Could not load the route right now. It will try again{live ? ' in 30 seconds' : ' when you reload'}.
        </p>
      )}

      {route && route.points.length === 0 && (
        <p className="text-sm text-gray-700">
          {live
            ? 'No location from the driver yet. It shows up here once their phone starts sharing.'
            : 'The driver phone did not share a location for this job.'}
        </p>
      )}

      {route && route.points.length > 0 && (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <dt className="text-gray-600">Location updates</dt>
              <dd className="font-medium text-gray-900">{route.points.length}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Distance shared</dt>
              <dd className="font-medium text-gray-900">{milesLabel(route.distanceMeters)}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Last update</dt>
              <dd className="font-medium text-gray-900" aria-live={live ? 'polite' : undefined}>
                {locationAgeLabel(route.lastAt, nowMs)}
              </dd>
            </div>
          </dl>
          {route.points.length > 1 && (
            <RouteMap points={route.points} pickup={pickup} dropoff={dropoff} live={live} />
          )}
          {last && (
            <p className="mt-3 text-sm">
              <a
                href={mapsLink(last)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-epyc-primary hover:text-blue-700 underline"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {live ? 'Open the driver\'s last location in Google Maps' : 'Open the last shared location in Google Maps'}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
          <p className="mt-2 text-xs text-gray-600">
            Distance counts only between shared updates, so it can read a little short of the real drive.
            Location history is kept for 90 days.
          </p>
        </>
      )}
    </section>
  );
}

function RouteMap({
  points,
  pickup,
  dropoff,
  live,
}: {
  points: LatLng[];
  pickup: LatLng | null;
  dropoff: LatLng | null;
  live: boolean;
}) {
  const { isLoaded, loadError, google } = useGoogleMaps({ libraries: ['places'] });
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawnRef = useRef<Array<google.maps.Marker | google.maps.Polyline>>([]);

  useEffect(() => {
    if (!isLoaded || !google || !divRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(divRef.current, {
        center: points[points.length - 1],
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
      });
    }
    const map = mapRef.current;
    drawnRef.current.forEach((d) => d.setMap(null));
    drawnRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    drawnRef.current.push(
      new google.maps.Polyline({ path: points, map, strokeColor: '#1D4ED8', strokeOpacity: 0.9, strokeWeight: 4 })
    );
    const dot = (p: LatLng | null, title: string, color: string, scale = 7) => {
      if (!p) return;
      bounds.extend(p);
      drawnRef.current.push(
        new google.maps.Marker({
          position: p,
          map,
          title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        })
      );
    };
    dot(pickup, 'Pickup', '#F59E0B');
    dot(dropoff, 'Drop-off', '#16A34A');
    dot(points[points.length - 1], live ? 'Driver now' : 'Last shared location', '#1D4ED8', 9);
    map.fitBounds(bounds, 40);
  }, [isLoaded, google, points, pickup, dropoff, live]);

  if (loadError) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 rounded-lg bg-gray-50 text-sm text-gray-700">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        Map unavailable. Use the Google Maps link below.
      </div>
    );
  }
  return (
    <div
      ref={divRef}
      className="h-72 w-full rounded-lg bg-gray-100"
      role="img"
      aria-label={`Map of the driver's route for this job, ${points.length} location updates, from the first update to the ${
        live ? 'driver now' : 'last shared location'
      }. The same facts are listed in text above the map.`}
    />
  );
}
