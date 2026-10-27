// Pure helpers for the "Install the app" card. No DOM access here, so they
// are unit tested; components pass in what they read from the browser.

export type InstallPlatform = 'ios' | 'android' | 'other';
export type InstallCardMode = 'ios-steps' | 'native-prompt' | 'none';

export const INSTALL_DISMISSED_KEY = 'epyc-driver-install-dismissed';
export const ALERTS_DISMISSED_KEY = 'epyc-driver-alerts-dismissed';

export const DRIVER_SW_URL = '/driver-sw.js';
export const DRIVER_SW_SCOPE = '/driver/';

/**
 * iPadOS 13+ reports itself as a Mac ("MacIntel") but has a touch screen,
 * so maxTouchPoints is used to tell them apart.
 */
export function detectPlatform(userAgent: string, platform = '', maxTouchPoints = 0): InstallPlatform {
  const ua = userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (platform === 'MacIntel' && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export interface InstallCardInput {
  platform: InstallPlatform;
  standalone: boolean;
  dismissed: boolean;
  hasNativePrompt: boolean;
}

/**
 * Which install card to show, if any.
 * - Already installed (running standalone) or dismissed: nothing.
 * - A captured beforeinstallprompt event (Chrome, Edge, Samsung Internet): one-tap button.
 * - iPhone/iPad (no install API on iOS): the Share -> Add to Home Screen steps.
 * - Anything else (desktop, Firefox Android before the browser offers it): nothing.
 */
export function installCardMode({ platform, standalone, dismissed, hasNativePrompt }: InstallCardInput): InstallCardMode {
  if (standalone || dismissed) return 'none';
  if (hasNativePrompt) return 'native-prompt';
  if (platform === 'ios') return 'ios-steps';
  return 'none';
}

export interface AlertsButtonInput {
  vapidPublicKey: string | undefined;
  standalone: boolean;
  pushSupported: boolean;
  permission: 'default' | 'granted' | 'denied' | 'unsupported';
  subscribed: boolean;
  dismissed: boolean;
}

/**
 * "Turn on job alerts" is offered only after install, only when the server
 * side is configured (VAPID public key present), and only when the browser can
 * actually do push. iOS exposes push only to home-screen apps (iOS 16.4+).
 */
export function shouldOfferJobAlerts(input: AlertsButtonInput): boolean {
  if (!input.vapidPublicKey || !input.vapidPublicKey.trim()) return false;
  if (!input.standalone) return false;
  if (!input.pushSupported) return false;
  if (input.permission === 'denied' || input.permission === 'unsupported') return false;
  if (input.subscribed || input.dismissed) return false;
  return true;
}

/** Decode a URL-safe base64 VAPID public key into the bytes PushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Shape a PushSubscription JSON into the push_subscriptions row (minus profile_id). */
export function subscriptionRow(
  json: { endpoint?: string; keys?: { p256dh?: string; auth?: string } },
  userAgent: string
): { endpoint: string; p256dh: string; auth: string; user_agent: string | null } | null {
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  if (!/^https:\/\//.test(endpoint)) return null;
  return { endpoint, p256dh, auth, user_agent: userAgent ? userAgent.slice(0, 500) : null };
}
