import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  installCardMode,
  shouldOfferJobAlerts,
  subscriptionRow,
  urlBase64ToUint8Array,
} from './install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('detectPlatform', () => {
  it('detects iPhone, Android, desktop', () => {
    expect(detectPlatform(IPHONE)).toBe('ios');
    expect(detectPlatform(ANDROID)).toBe('android');
    expect(detectPlatform(MAC, 'MacIntel', 0)).toBe('other');
  });
  it('treats an iPad posing as a Mac (touch screen) as iOS', () => {
    expect(detectPlatform(MAC, 'MacIntel', 5)).toBe('ios');
  });
  it('handles an empty user agent', () => {
    expect(detectPlatform('')).toBe('other');
  });
});

describe('installCardMode', () => {
  const base = { platform: 'ios' as const, standalone: false, dismissed: false, hasNativePrompt: false };
  it('shows iPhone steps on iOS', () => {
    expect(installCardMode(base)).toBe('ios-steps');
  });
  it('prefers the one-tap prompt when the browser offers one', () => {
    expect(installCardMode({ ...base, platform: 'android', hasNativePrompt: true })).toBe('native-prompt');
  });
  it('hides once installed or dismissed', () => {
    expect(installCardMode({ ...base, standalone: true })).toBe('none');
    expect(installCardMode({ ...base, dismissed: true })).toBe('none');
    expect(installCardMode({ ...base, platform: 'android', hasNativePrompt: true, standalone: true })).toBe('none');
  });
  it('hides on Android or desktop with no prompt captured', () => {
    expect(installCardMode({ ...base, platform: 'android' })).toBe('none');
    expect(installCardMode({ ...base, platform: 'other' })).toBe('none');
  });
});

describe('shouldOfferJobAlerts', () => {
  const ok = {
    vapidPublicKey: 'BKey',
    standalone: true,
    pushSupported: true,
    permission: 'default' as const,
    subscribed: false,
    dismissed: false,
  };
  it('offers when installed, configured, and supported', () => {
    expect(shouldOfferJobAlerts(ok)).toBe(true);
  });
  it('hides the button when the VAPID key env var is absent', () => {
    expect(shouldOfferJobAlerts({ ...ok, vapidPublicKey: undefined })).toBe(false);
    expect(shouldOfferJobAlerts({ ...ok, vapidPublicKey: '  ' })).toBe(false);
  });
  it('hides before install, when unsupported, denied, subscribed, or dismissed', () => {
    expect(shouldOfferJobAlerts({ ...ok, standalone: false })).toBe(false);
    expect(shouldOfferJobAlerts({ ...ok, pushSupported: false })).toBe(false);
    expect(shouldOfferJobAlerts({ ...ok, permission: 'denied' })).toBe(false);
    expect(shouldOfferJobAlerts({ ...ok, permission: 'unsupported' })).toBe(false);
    expect(shouldOfferJobAlerts({ ...ok, subscribed: true })).toBe(false);
    expect(shouldOfferJobAlerts({ ...ok, dismissed: true })).toBe(false);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes URL-safe base64 without padding', () => {
    // bytes fb ff fe -> standard "+//+" -> url-safe "-__-"
    expect(Array.from(urlBase64ToUint8Array('-__-'))).toEqual([0xfb, 0xff, 0xfe]);
    expect(Array.from(urlBase64ToUint8Array('AQI'))).toEqual([1, 2]);
  });
  it('decodes a 65-byte VAPID-length key', () => {
    const bytes = new Uint8Array(65).map((_, i) => i);
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(Array.from(urlBase64ToUint8Array(b64))).toEqual(Array.from(bytes));
  });
});

describe('subscriptionRow', () => {
  it('maps a PushSubscription JSON to a row', () => {
    expect(
      subscriptionRow({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } }, 'UA')
    ).toEqual({ endpoint: 'https://push.example/abc', p256dh: 'P', auth: 'A', user_agent: 'UA' });
  });
  it('rejects missing keys or a non-https endpoint', () => {
    expect(subscriptionRow({ endpoint: 'https://x', keys: { p256dh: 'P' } }, '')).toBeNull();
    expect(subscriptionRow({ endpoint: 'http://x', keys: { p256dh: 'P', auth: 'A' } }, '')).toBeNull();
    expect(subscriptionRow({}, '')).toBeNull();
  });
  it('caps the user agent at 500 chars and nulls an empty one', () => {
    const row = subscriptionRow({ endpoint: 'https://x', keys: { p256dh: 'P', auth: 'A' } }, 'u'.repeat(900));
    expect(row?.user_agent).toHaveLength(500);
    expect(subscriptionRow({ endpoint: 'https://x', keys: { p256dh: 'P', auth: 'A' } }, '')?.user_agent).toBeNull();
  });
});
