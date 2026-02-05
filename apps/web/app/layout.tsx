import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'EPYC Courier Service | 24/7 Same-Day Delivery | Los Angeles',
    template: '%s | EPYC Courier Service',
  },
  description: "Southern California's trusted same-day courier service. Medical specimen delivery, legal documents, commercial packages. HIPAA compliant, GPS tracking, proof of delivery.",
  keywords: ['courier service Los Angeles', 'same day delivery Southern California', 'medical courier', 'legal courier', 'HIPAA compliant delivery'],
  authors: [{ name: 'EPYC Courier Service' }],
  openGraph: {
    title: 'EPYC Courier Service | 24/7 Same-Day Delivery',
    description: "Southern California's trusted same-day courier service. Medical, legal, and commercial delivery.",
    url: 'https://epyccs.com',
    siteName: 'EPYC Courier Service',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
