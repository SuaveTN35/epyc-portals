// Bridge to the EPYC Driver phone app (apps/driver-app, Capacitor).
//
// The phone app loads these same web pages inside a native shell. When a page
// runs there, Capacitor puts a `Capacitor` object on window with the native
// plugins. These helpers use the native plugin when it is there and fall back
// to the browser otherwise, so every screen keeps working on the website too.
//
// Nothing here imports @capacitor/* packages: the website never ships them.

export interface NativeFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
}

export type NativeLocationError = 'denied' | 'error';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: Record<string, unknown>;
}

interface BackgroundGeolocationPlugin {
  addWatcher: (
    options: {
      backgroundTitle?: string;
      backgroundMessage?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (
      location?: {
        latitude: number;
        longitude: number;
        accuracy: number;
        speed: number | null;
        bearing: number | null;
      },
      error?: { code?: string; message?: string }
    ) => void
  ) => Promise<string>;
  removeWatcher: (options: { id: string }) => Promise<void>;
  openSettings: () => Promise<void>;
}

interface HapticsPlugin {
  vibrate: (options?: { duration?: number }) => Promise<void>;
  notification: (options?: { type?: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>;
}

function capacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null) as CapacitorGlobal | null;
}

/** True inside the EPYC Driver app on a phone, false on the website. */
export function isNativeApp(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

function plugin<T>(name: string): T | null {
  const cap = capacitor();
  if (!cap || !isNativeApp()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable(name)) return null;
  return (cap.Plugins?.[name] as T | undefined) ?? null;
}

/** True when the app can share location with the screen off. */
export function hasBackgroundLocation(): boolean {
  return plugin<BackgroundGeolocationPlugin>('BackgroundGeolocation') !== null;
}

/**
 * Watches location through the native plugin, which keeps working while the
 * phone is locked (iPhone shows the blue location pill, Android shows an
 * ongoing notification). Returns a stop function, or null when the native
 * plugin is not there (use the browser instead).
 */
export async function watchNativeLocation(
  onFix: (fix: NativeFix) => void,
  onError: (error: NativeLocationError) => void
): Promise<(() => void) | null> {
  const geo = plugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
  if (!geo) return null;
  const id = await geo.addWatcher(
    {
      backgroundTitle: 'Epyc delivery in progress',
      backgroundMessage: 'Sharing your location with dispatch and the customer until the delivery is done.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 25,
    },
    (location, error) => {
      if (error) {
        onError(error.code === 'NOT_AUTHORIZED' ? 'denied' : 'error');
        return;
      }
      if (!location) return;
      onFix({
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy ?? null,
        speed: location.speed ?? null,
        heading: location.bearing ?? null,
      });
    }
  );
  return () => {
    void geo.removeWatcher({ id }).catch(() => undefined);
  };
}

/** Opens the phone's settings for the app (after location was refused). */
export function openNativeSettings(): boolean {
  const geo = plugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
  if (!geo) return false;
  void geo.openSettings().catch(() => undefined);
  return true;
}

/**
 * A vibration that goes with an on-screen notice, so an alert never depends on
 * sound alone. Uses the phone's haptics in the app (iPhone browsers cannot
 * vibrate), and the browser vibration API on the website where supported.
 */
export function hapticAlert(pattern: number[], kind: 'notice' | 'problem' = 'notice'): void {
  const haptics = plugin<HapticsPlugin>('Haptics');
  if (haptics) {
    void haptics.notification({ type: kind === 'problem' ? 'WARNING' : 'SUCCESS' }).catch(() => undefined);
    return;
  }
  try {
    if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern);
  } catch {
    // Not supported: the on-screen notice still shows.
  }
}
