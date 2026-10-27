'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Shown while the phone reports no connection (navigator.onLine is false). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-50 bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-center"
    >
      <WifiOff className="h-4 w-4 mr-2 flex-shrink-0" />
      Connection lost - your last action may not have saved
    </div>
  );
}
