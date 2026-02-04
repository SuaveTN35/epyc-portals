import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EPYC Courier Service - Client Portal',
  description: 'Book, track, and manage your deliveries with EPYC Courier Service.',
  keywords: ['courier', 'delivery', 'same-day', 'medical courier', 'Los Angeles'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
