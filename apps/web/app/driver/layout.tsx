import type { Metadata, Viewport } from 'next';
import { DriverPwa } from '@/components/driver/DriverPwa';

// Driver-only app install metadata. The manifest and the iOS home-screen tags
// are linked here and nowhere else, so marketing and customer pages never
// prompt anyone to install the driver app.
export const metadata: Metadata = {
  manifest: '/driver.webmanifest',
  applicationName: 'EPYC Driver',
  appleWebApp: {
    capable: true,
    title: 'EPYC Driver',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/driver-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/driver-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/driver-apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Next 15 emits only "mobile-web-app-capable"; older iOS reads the apple- tag.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#065F46', // epyc-primary (tailwind.config.ts), matches the driver header
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DriverPwa />
      {children}
    </>
  );
}
