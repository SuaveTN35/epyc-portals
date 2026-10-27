'use client';

import { useEffect, useState } from 'react';
import { Bell, Download, Share, SquarePlus, X } from 'lucide-react';
import {
  ALERTS_DISMISSED_KEY,
  INSTALL_DISMISSED_KEY,
  detectPlatform,
  installCardMode,
  shouldOfferJobAlerts,
  type InstallCardMode,
} from '@/lib/pwa/install';
import {
  getInstallPrompt,
  hasPushSubscription,
  isStandalone,
  notificationPermission,
  onInstallPromptChange,
  pushSupported,
  readFlag,
  setInstallPrompt,
  subscribeToJobAlerts,
  writeFlag,
} from '@/lib/pwa/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Jobs screen card. Before install: "Install the app" (one tap on Android /
 * Chrome, three steps on iPhone). After install, if push is configured:
 * "Turn on job alerts". Renders nothing on the server or until the browser
 * state is known, so there is no hydration flash.
 */
export function InstallAppCard() {
  const [mode, setMode] = useState<InstallCardMode>('none');
  const [offerAlerts, setOfferAlerts] = useState(false);
  const [alertsMsg, setAlertsMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();
    const platform = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

    const refreshInstall = () =>
      setMode(
        installCardMode({
          platform,
          standalone: standalone || isStandalone(),
          dismissed: readFlag(INSTALL_DISMISSED_KEY),
          hasNativePrompt: getInstallPrompt() !== null,
        })
      );
    refreshInstall();
    const unsubscribe = onInstallPromptChange(refreshInstall);

    let cancelled = false;
    if (standalone) {
      hasPushSubscription()
        .catch(() => false)
        .then((subscribed) => {
          if (cancelled) return;
          setOfferAlerts(
            shouldOfferJobAlerts({
              vapidPublicKey: VAPID_PUBLIC_KEY,
              standalone,
              pushSupported: pushSupported(),
              permission: notificationPermission(),
              subscribed,
              dismissed: readFlag(ALERTS_DISMISSED_KEY),
            })
          );
        });
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const dismissInstall = () => {
    writeFlag(INSTALL_DISMISSED_KEY);
    setMode('none');
  };

  const nativeInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    setInstallPrompt(null); // a prompt event can be used only once
    if (choice?.outcome === 'accepted') setMode('none');
  };

  const dismissAlerts = () => {
    writeFlag(ALERTS_DISMISSED_KEY);
    setOfferAlerts(false);
  };

  const turnOnAlerts = async () => {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    setAlertsMsg(null);
    const result = await subscribeToJobAlerts(VAPID_PUBLIC_KEY);
    setBusy(false);
    if (result === 'subscribed') {
      setOfferAlerts(false);
      setAlertsMsg('Job alerts are on for this phone.');
    } else if (result === 'denied') {
      setOfferAlerts(false);
      setAlertsMsg('Alerts are blocked. You can allow them later in your phone settings.');
    } else {
      setAlertsMsg('Could not turn on alerts. Try again later.');
    }
  };

  if (alertsMsg && !offerAlerts) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 text-sm text-gray-700" role="status">
        {alertsMsg}
      </div>
    );
  }

  if (offerAlerts) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <Bell className="h-6 w-6 text-epyc-primary mr-3 flex-shrink-0" />
            <div>
              <h2 className="font-semibold text-gray-900">Get job alerts</h2>
              <p className="text-sm text-gray-600">We will let you know when a new job is offered to you.</p>
            </div>
          </div>
          <button onClick={dismissAlerts} aria-label="Not now" className="text-gray-400 p-1 -m-1 touch-target">
            <X className="h-5 w-5" />
          </button>
        </div>
        {alertsMsg && <p className="text-sm text-red-700 mt-2">{alertsMsg}</p>}
        <button
          onClick={turnOnAlerts}
          disabled={busy}
          className="mt-3 w-full py-3 bg-epyc-primary text-white rounded-xl font-semibold touch-target disabled:opacity-60"
        >
          {busy ? 'Turning on...' : 'Turn on job alerts'}
        </button>
      </div>
    );
  }

  if (mode === 'none') return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <Download className="h-6 w-6 text-epyc-primary mr-3 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900">Install the app</h2>
            <p className="text-sm text-gray-600">Open EPYC Driver from your home screen, full screen, in one tap.</p>
          </div>
        </div>
        <button onClick={dismissInstall} aria-label="Dismiss" className="text-gray-400 p-1 -m-1 touch-target">
          <X className="h-5 w-5" />
        </button>
      </div>

      {mode === 'native-prompt' ? (
        <button
          onClick={nativeInstall}
          className="mt-3 w-full py-3 bg-epyc-primary text-white rounded-xl font-semibold touch-target"
        >
          Install EPYC Driver
        </button>
      ) : (
        <IosSteps />
      )}
    </div>
  );
}

/** The three iPhone steps. Exported for the Help page. */
export function IosSteps() {
  return (
    <ol className="mt-3 space-y-2 text-sm text-gray-700">
      <li className="flex items-center">
        <span className="h-6 w-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mr-2 flex-shrink-0">
          1
        </span>
        Tap the Share button
        <Share className="h-5 w-5 text-blue-600 ml-2" aria-label="Share icon" />
      </li>
      <li className="flex items-center">
        <span className="h-6 w-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mr-2 flex-shrink-0">
          2
        </span>
        Scroll down and tap Add to Home Screen
        <SquarePlus className="h-5 w-5 text-gray-700 ml-2" aria-label="Add icon" />
      </li>
      <li className="flex items-center">
        <span className="h-6 w-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mr-2 flex-shrink-0">
          3
        </span>
        Tap Add in the top corner
      </li>
    </ol>
  );
}
