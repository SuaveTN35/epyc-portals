// Browser-only PWA helpers for the driver app. Import from client components only.
import { createClient } from '@/lib/supabase/client';
import { DRIVER_SW_SCOPE, DRIVER_SW_URL, subscriptionRow, urlBase64ToUint8Array } from './install';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// The beforeinstallprompt event can fire on any driver page, before the Jobs
// screen mounts. The driver layout captures it here; the install card reads it.
let capturedPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function setInstallPrompt(e: BeforeInstallPromptEvent | null) {
  capturedPrompt = e;
  listeners.forEach((l) => l());
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return capturedPrompt;
}

export function onInstallPromptChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Private mode or storage full: the card simply shows again next time.
  }
}

export async function registerDriverServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(DRIVER_SW_URL, { scope: DRIVER_SW_SCOPE });
  } catch {
    return null;
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function notificationPermission(): 'default' | 'granted' | 'denied' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration(DRIVER_SW_SCOPE);
  if (!reg) return false;
  return (await reg.pushManager.getSubscription()) !== null;
}

export type JobAlertsResult = 'subscribed' | 'denied' | 'unavailable' | 'error';

/**
 * Ask for notification permission, subscribe this phone, and save the
 * subscription to push_subscriptions (RLS: the driver can only write their
 * own rows). Must be called from a tap (iOS requires a user gesture).
 */
export async function subscribeToJobAlerts(vapidPublicKey: string): Promise<JobAlertsResult> {
  if (!pushSupported() || !vapidPublicKey) return 'unavailable';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const reg =
    (await navigator.serviceWorker.getRegistration(DRIVER_SW_SCOPE)) ?? (await registerDriverServiceWorker());
  if (!reg) return 'unavailable';
  await navigator.serviceWorker.ready;

  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      }));

    const row = subscriptionRow(sub.toJSON(), navigator.userAgent);
    if (!row) return 'error';

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'error';

    // No UPDATE policy by design: replace this driver's row for this endpoint.
    await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
    const { error } = await supabase.from('push_subscriptions').insert({ ...row, profile_id: user.id });
    if (error) return 'error';
    return 'subscribed';
  } catch {
    return 'error';
  }
}
