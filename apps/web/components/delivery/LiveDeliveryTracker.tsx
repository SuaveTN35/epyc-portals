'use client';

// Customer delivery page: follows the job live. Polls the job's status and the
// driver's latest position every 15 seconds; when the status changes it
// refreshes the page so the timeline, driver card and proof update too.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation } from 'lucide-react';
import { useGoogleMaps } from '@/lib/hooks/useGoogleMaps';
import { isLiveTrackingStatus, locationAgeLabel, mapsLink, type LatLng } from '@/lib/live-location';
import { trackingHeadline } from '@/lib/client-alerts';

interface LiveData {
  status: string;
  driver: (LatLng & { recordedAt: string }) | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
}

const POLL_MS = 15_000;
const FINAL = ['delivered', 'cancelled', 'failed'];

export function LiveDeliveryTracker({ deliveryId, initialStatus }: { deliveryId: string; initialStatus: string }) {
  const router = useRouter();
  const [data, setData] = useState<LiveData | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const statusRef = useRef(initialStatus);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/client/deliveries/${deliveryId}/live`, { cache: 'no-store' });
      if (res.status === 503) {
        setNotSetUp(true);
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as LiveData;
      setData(next);
      setNowMs(Date.now());
      if (next.status !== statusRef.current) {
        statusRef.current = next.status;
        router.refresh();
      }
    } catch {
      // Offline: try again on the next tick.
    }
  }, [deliveryId, router]);

  useEffect(() => {
    if (FINAL.includes(initialStatus)) return;
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initialStatus, load]);

  const status = data?.status ?? initialStatus;
  if (FINAL.includes(initialStatus) || FINAL.includes(status)) return null;
  const live = isLiveTrackingStatus(status);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="live-tracking-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <h2 id="live-tracking-heading" className="font-semibold text-gray-900">Live tracking</h2>
        </div>
        <p className="text-sm font-medium text-gray-700" role="status" aria-live="polite">
          {trackingHeadline(status)}
        </p>
      </div>

      {notSetUp ? (
        <p className="text-sm text-gray-700">Live tracking is not set up on this site yet. Status updates still appear below.</p>
      ) : !live ? (
        <p className="text-sm text-gray-700">The map appears here once a driver is on the way. This page updates on its own.</p>
      ) : (
        <>
          <LiveMap driver={data?.driver ?? null} pickup={data?.pickup ?? null} dropoff={data?.dropoff ?? null} status={status} />
          <p className="mt-2 text-sm text-gray-700">
            {data?.driver ? (
              <>
                Driver location updated {locationAgeLabel(data.driver.recordedAt, nowMs)}.{' '}
                <a
                  href={mapsLink(data.driver)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-epyc-primary underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-epyc-primary rounded"
                >
                  Open driver location in Google Maps
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : (
              'Waiting for the driver\'s location. It shows while the driver has the Epyc app open.'
            )}
          </p>
        </>
      )}
    </section>
  );
}

function LiveMap({
  driver,
  pickup,
  dropoff,
  status,
}: {
  driver: LatLng | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  status: string;
}) {
  const { isLoaded, loadError, google } = useGoogleMaps({ libraries: ['places'] });
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !google || !divRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(divRef.current, {
      center: driver ?? pickup ?? { lat: 34.0522, lng: -118.2437 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
    });
  }, [isLoaded, google, driver, pickup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!google || !map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    const headingToPickup = ['assigned', 'en_route_pickup', 'arrived_pickup'].includes(status);
    const add = (p: LatLng | null, label: string, color: string, scale = 8) => {
      if (!p) return;
      markersRef.current.push(
        new google.maps.Marker({
          position: p,
          map,
          title: label,
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
      bounds.extend(p);
    };
    if (headingToPickup) add(pickup, 'Pickup', '#F59E0B');
    add(dropoff, 'Drop-off', '#16A34A');
    add(driver, 'Driver', '#2563EB', 10);
    if (!bounds.isEmpty() && !fittedRef.current) {
      map.fitBounds(bounds, 48);
      fittedRef.current = !!driver;
    }
  }, [google, isLoaded, driver, pickup, dropoff, status]);

  if (loadError) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 rounded-lg bg-gray-50 text-sm text-gray-700">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        Map unavailable. Use the Google Maps link below.
      </div>
    );
  }
  return (
    <div className="relative">
      {/* The map is a visual extra; the same facts are in text below it. */}
      <div
        ref={divRef}
        className="h-64 w-full rounded-lg bg-gray-100"
        role="img"
        aria-label={
          driver
            ? 'Map showing the driver\'s current location and the drop-off point'
            : 'Map of the delivery route. The driver location is not available yet.'
        }
      />
      {!driver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs text-gray-700 shadow">
            <Navigation className="h-3 w-3" aria-hidden="true" /> Waiting for driver location
          </span>
        </div>
      )}
    </div>
  );
}
