'use client';

// Shares the driver's GPS position while a job is active, so dispatch's live
// map and the customer's delivery page can follow the job. Runs only while
// this screen is open: phone browsers pause GPS for pages in the background,
// which is why the screen is kept awake while sharing. Background tracking
// needs the native driver app (next phase).

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { locationAgeLabel, shouldSendLocation, type LatLng } from '@/lib/live-location';

type SharingState = 'starting' | 'on' | 'denied' | 'unavailable' | 'error' | 'stopped';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export function LocationSharing({ deliveryId, active }: { deliveryId: string; active: boolean }) {
  const [state, setState] = useState<SharingState>('starting');
  const [lastSentIso, setLastSentIso] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastSent = useRef<(LatLng & { atMs: number }) | null>(null);
  const sending = useRef(false);
  const stopped = useRef(false);
  // Shown before the phone's own location prompt (Google Play "prominent
  // disclosure", App Store 5.1.1): null while checking, false until the driver
  // taps Turn on location, true once allowed or already granted.
  const [consented, setConsented] = useState<boolean | null>(null);

  useEffect(() => {
    if (!active || consented !== null) return;
    let cancelled = false;
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    if (!perms?.query) {
      setConsented(false);
      return;
    }
    perms
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (!cancelled) setConsented(status.state === 'granted');
      })
      .catch(() => {
        if (!cancelled) setConsented(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, consented]);

  // Refresh the "updated X ago" label.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!active || consented !== true) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unavailable');
      return;
    }
    stopped.current = false;
    setState('starting');

    const send = async (pos: GeolocationPosition) => {
      if (stopped.current || sending.current) return;
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const now = Date.now();
      if (!shouldSendLocation(lastSent.current, next, now)) return;
      sending.current = true;
      try {
        const res = await fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            deliveryId,
            lat: next.lat,
            lng: next.lng,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; stop?: boolean };
        if (data.stop) {
          stopped.current = true;
          setState('stopped');
          return;
        }
        if (res.ok && data.ok) {
          lastSent.current = { ...next, atMs: now };
          setLastSentIso(new Date(now).toISOString());
          setState('on');
        } else if (res.status !== 429) {
          setState('error');
        }
      } catch {
        // Offline: keep watching; the next fix tries again.
        setState((s) => (s === 'on' ? 'on' : 'error'));
      } finally {
        sending.current = false;
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => void send(pos),
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    );

    // Keep the screen on while sharing, where the phone allows it.
    let wakeLock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
    const requestWakeLock = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === 'visible') wakeLock = await nav.wakeLock.request('screen');
      } catch {
        // Not allowed (battery saver, older phone): sharing still works while the screen is on.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    void requestWakeLock();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped.current = true;
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', onVisible);
      void wakeLock?.release().catch(() => undefined);
    };
  }, [active, deliveryId, consented]);

  // A problem is shown on screen and, where the phone allows, felt as a
  // vibration, so it never depends on sound or on sight alone.
  const problem = state === 'denied' || state === 'unavailable' || state === 'error';
  useEffect(() => {
    if (!active || !problem) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Not supported (iPhone Safari): the on-screen notice still shows.
    }
  }, [active, problem]);

  if (!active || state === 'stopped' || consented === null) return null;

  if (consented === false) {
    return (
      <section
        aria-labelledby="location-explainer-heading"
        className="mx-4 mt-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-800"
      >
        <h2 id="location-explainer-heading" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <MapPin className="h-5 w-5 flex-none" aria-hidden="true" />
          Share your location for this job
        </h2>
        <p className="mt-2">
          Epyc uses your phone&apos;s location while you have a job in progress, from accepting it until delivery, so
          the customer and dispatch can see where the delivery is. It is not collected when you have no job.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setConsented(true)}
            className="min-h-[44px] rounded-lg bg-epyc-primary px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-epyc-primary focus-visible:ring-offset-2"
          >
            Turn on location
          </button>
          <a href="/privacy" className="text-epyc-primary underline">
            Privacy policy
          </a>
        </div>
      </section>
    );
  }

  const tone =
    state === 'on'
      ? 'bg-green-50 border-green-200 text-green-800'
      : state === 'starting'
        ? 'bg-gray-50 border-gray-200 text-gray-700'
        : 'bg-amber-50 border-amber-200 text-amber-900';
  const message =
    state === 'on'
      ? `Sharing your location with dispatch and the customer. Last sent ${locationAgeLabel(lastSentIso, nowMs)}. Keep this screen open.`
      : state === 'starting'
        ? 'Turning on location sharing...'
        : state === 'denied'
          ? 'Location is off for this site. Turn on location for Epyc in your phone settings so the customer can follow the delivery.'
          : state === 'unavailable'
            ? 'This phone cannot share location from the browser.'
            : 'Location could not be sent. It will keep trying.';

  return (
    <div
      className={`mx-4 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-base ${tone}`}
      role={problem ? 'alert' : 'status'}
      aria-live={problem ? 'assertive' : 'polite'}
    >
      <MapPin className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
