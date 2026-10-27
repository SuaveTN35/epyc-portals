'use client';

import { useEffect } from 'react';
import { registerDriverServiceWorker, setInstallPrompt, type BeforeInstallPromptEvent } from '@/lib/pwa/client';

/**
 * Mounted once in the driver layout. Registers the driver service worker
 * (scope /driver/ only; marketing and customer pages are never controlled)
 * and captures the browser's install prompt for the Jobs screen card.
 *
 * The service worker is production only: dev builds serve unhashed
 * /_next/static files, which a cache-first worker would pin stale.
 */
export function DriverPwa() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the mini-infobar away; our card offers it
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if (process.env.NODE_ENV === 'production') {
      void registerDriverServiceWorker();
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return null;
}
