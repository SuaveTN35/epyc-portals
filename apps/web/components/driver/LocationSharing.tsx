'use client';

// Shares the driver's GPS position while a job is active, so dispatch's live
// map and the customer's delivery page can follow the job. Runs only while
// the job screen is open in a phone browser (browsers pause GPS for pages in
// the background, which is why the screen is kept awake). In the EPYC Driver
// phone app the native plugin keeps sharing with the screen locked, until the
// job is done.

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  locationAgeLabel,
  queueOfflineFix,
  shouldSendLocation,
  type LatLng,
  type PendingFix,
} from '@/lib/live-location';
import {
  hapticAlert,
  hasBackgroundLocation,
  openNativeSettings,
  watchNativeLocation,
  type NativeFix,
} from '@/lib/native-app';

// In the phone app the driver's yes to the explainer is remembered on the
// phone, since the browser permission check is not available there.
const NATIVE_CONSENT_KEY = 'epyc-location-explainer-accepted';

type SharingState = 'starting' | 'on' | 'offline' | 'denied' | 'unavailable' | 'error' | 'stopped';

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
  // Fixes taken with no signal (a dead zone, a parking garage). They are sent
  // with their real time once the phone is back online, so dispatch's route
  // has no gap.
  const pending = useRef<PendingFix[]>([]);
  const flushing = useRef(false);
  // Shown before the phone's own location prompt (Google Play "prominent
  // disclosure", App Store 5.1.1): null while checking, false until the driver
  // taps Turn on location, true once allowed or already granted.
  const [consented, setConsented] = useState<boolean | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    if (!active || consented !== null) return;
    let cancelled = false;
    if (hasBackgroundLocation()) {
      setNative(true);
      let accepted = false;
      try {
        accepted = window.localStorage.getItem(NATIVE_CONSENT_KEY) === 'yes';
      } catch {
        // Storage blocked: show the explainer again.
      }
      setConsented(accepted);
      return;
    }
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
    const useNative = native && hasBackgroundLocation();
    if (!useNative && (typeof navigator === 'undefined' || !navigator.geolocation)) {
      setState('unavailable');
      return;
    }
    stopped.current = false;
    setState('starting');

    const post = (body: Record<string, unknown>) =>
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ deliveryId, ...body }),
      });

    const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

    const keepForLater = (fix: NativeFix, now: number) => {
      pending.current = queueOfflineFix(
        pending.current,
        { lat: fix.lat, lng: fix.lng, speed: fix.speed, heading: fix.heading, atMs: now },
        now
      );
      setState('offline');
    };

    // Sends the fixes kept while offline, oldest first, each with its real time.
    const flushPending = async () => {
      if (flushing.current || stopped.current || pending.current.length === 0) return;
      flushing.current = true;
      try {
        while (pending.current.length > 0 && !stopped.current) {
          const f = pending.current[0];
          const res = await post({
            lat: f.lat,
            lng: f.lng,
            speed: f.speed,
            heading: f.heading,
            recordedAt: new Date(f.atMs).toISOString(),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; stop?: boolean };
          if (data.stop) {
            stopped.current = true;
            pending.current = [];
            setState('stopped');
            return;
          }
          if (res.status === 429 || res.status >= 500) return; // try again on the next fix
          pending.current = pending.current.slice(1); // sent, or refused as bad: either way done with it
        }
      } catch {
        // Still offline: keep the rest for later.
      } finally {
        flushing.current = false;
      }
    };

    const send = async (fix: NativeFix) => {
      if (stopped.current || sending.current) return;
      const next = { lat: fix.lat, lng: fix.lng };
      const now = Date.now();
      if (isOffline()) {
        keepForLater(fix, now);
        return;
      }
      if (!shouldSendLocation(lastSent.current, next, now)) return;
      sending.current = true;
      try {
        const res = await post({
          lat: next.lat,
          lng: next.lng,
          accuracy: fix.accuracy,
          speed: fix.speed,
          heading: fix.heading,
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
          void flushPending();
        } else if (res.status !== 429) {
          setState('error');
        }
      } catch {
        // No signal: keep this fix and send it with its real time later.
        keepForLater(fix, now);
      } finally {
        sending.current = false;
      }
    };

    const onOnline = () => void flushPending();
    window.addEventListener('online', onOnline);

    if (useNative) {
      // Phone app: the native watcher keeps running with the screen locked.
      let stopNative: (() => void) | null = null;
      let ended = false;
      watchNativeLocation(
        (fix) => void send(fix),
        (err) => setState(err)
      )
        .then((stop) => {
          if (ended) stop?.();
          else stopNative = stop;
          if (!stop) setState('unavailable');
        })
        .catch(() => setState('error'));
      return () => {
        ended = true;
        stopped.current = true;
        window.removeEventListener('online', onOnline);
        stopNative?.();
      };
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        void send({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        }),
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
      window.removeEventListener('online', onOnline);
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', onVisible);
      void wakeLock?.release().catch(() => undefined);
    };
  }, [active, deliveryId, consented, native]);

  // A problem is shown on screen and, where the phone allows, felt as a
  // vibration, so it never depends on sound or on sight alone.
  const problem = state === 'denied' || state === 'unavailable' || state === 'error';
  useEffect(() => {
    if (!active || !problem) return;
    hapticAlert([200, 100, 200], 'problem');
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
          {native ? ' It keeps sharing while your phone is locked, until the delivery is done.' : ''}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (native) {
                try {
                  window.localStorage.setItem(NATIVE_CONSENT_KEY, 'yes');
                } catch {
                  // Storage blocked: the explainer shows again next job.
                }
              }
              setConsented(true);
            }}
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
      : state === 'starting' || state === 'offline'
        ? 'bg-gray-50 border-gray-200 text-gray-700'
        : 'bg-amber-50 border-amber-200 text-amber-900';
  const message =
    state === 'on'
      ? `Sharing your location with dispatch and the customer. Last sent ${locationAgeLabel(lastSentIso, nowMs)}. ${
          native ? 'You can lock your phone; sharing stops when the delivery is done.' : 'Keep this screen open.'
        }`
      : state === 'starting'
        ? 'Turning on location sharing...'
        : state === 'offline'
          ? 'No signal right now. Your location is saved on this phone and sends when you are back online. Keep driving.'
        : state === 'denied'
          ? native
            ? 'Location is off for the Epyc Driver app. Turn it on in your phone settings so the customer can follow the delivery.'
            : 'Location is off for this site. Turn on location for Epyc in your phone settings so the customer can follow the delivery.'
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
      <span>
        {message}
        {native && state === 'denied' ? (
          <>
            {' '}
            <button
              type="button"
              onClick={() => openNativeSettings()}
              className="min-h-[44px] font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
            >
              Open settings
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}
