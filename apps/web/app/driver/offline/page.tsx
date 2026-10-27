import type { Metadata } from 'next';
import { ReloadButton } from '@/components/driver/ReloadButton';

// Precached by /driver-sw.js and shown when a driver page cannot load.
// Static on purpose: it must never contain a signed-in driver's data.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function DriverOfflinePage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm p-6 max-w-sm w-full text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold"
        >
          !
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">No connection</h1>
        <p className="text-gray-700 mb-6">
          You&apos;re offline. Your last action may not have saved. Reconnect and refresh.
        </p>
        <ReloadButton className="block w-full py-3 bg-epyc-primary text-white rounded-xl font-semibold touch-target" />
      </div>
    </main>
  );
}
