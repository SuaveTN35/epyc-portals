import { describe, it, expect, vi, afterEach } from 'vitest';
import { hapticAlert, hasBackgroundLocation, isNativeApp, watchNativeLocation } from '@/lib/native-app';

type Cb = (loc?: Record<string, number | null>, err?: { code?: string }) => void;

function installCapacitor(plugins: Record<string, unknown>, native = true) {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => native,
    isPluginAvailable: (name: string) => name in plugins,
    Plugins: plugins,
  };
}

afterEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe('native app bridge', () => {
  it('is off on the website', async () => {
    expect(isNativeApp()).toBe(false);
    expect(hasBackgroundLocation()).toBe(false);
    expect(await watchNativeLocation(vi.fn(), vi.fn())).toBeNull();
  });

  it('is off when Capacitor is there but not on a phone', () => {
    installCapacitor({ BackgroundGeolocation: {} }, false);
    expect(isNativeApp()).toBe(false);
    expect(hasBackgroundLocation()).toBe(false);
  });

  it('watches location in the background and maps fixes and errors', async () => {
    let cb: Cb | null = null;
    const removeWatcher = vi.fn(async () => undefined);
    const addWatcher = vi.fn(async (_opts: unknown, fn: Cb) => {
      cb = fn;
      return 'w1';
    });
    installCapacitor({ BackgroundGeolocation: { addWatcher, removeWatcher, openSettings: vi.fn() } });
    const onFix = vi.fn();
    const onError = vi.fn();
    const stop = await watchNativeLocation(onFix, onError);
    expect(stop).toBeTypeOf('function');
    const opts = addWatcher.mock.calls[0][0] as { backgroundMessage?: string; requestPermissions?: boolean };
    // backgroundMessage is what keeps updates coming with the phone locked.
    expect(opts.backgroundMessage).toMatch(/until the delivery is done/);
    expect(opts.requestPermissions).toBe(true);

    cb!({ latitude: 34.1, longitude: -118.4, accuracy: 8, speed: 12, bearing: 90 });
    expect(onFix).toHaveBeenCalledWith({ lat: 34.1, lng: -118.4, accuracy: 8, speed: 12, heading: 90 });
    cb!(undefined, { code: 'NOT_AUTHORIZED' });
    expect(onError).toHaveBeenLastCalledWith('denied');
    cb!(undefined, { code: 'OTHER' });
    expect(onError).toHaveBeenLastCalledWith('error');

    stop!();
    expect(removeWatcher).toHaveBeenCalledWith({ id: 'w1' });
  });

  it('uses phone haptics in the app and browser vibration on the website', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    hapticAlert([100]);
    expect(vibrate).toHaveBeenCalledWith([100]);

    const notification = vi.fn(async () => undefined);
    installCapacitor({ Haptics: { notification, vibrate: vi.fn() } });
    vibrate.mockClear();
    hapticAlert([100], 'problem');
    expect(notification).toHaveBeenCalledWith({ type: 'WARNING' });
    expect(vibrate).not.toHaveBeenCalled();
  });
});
