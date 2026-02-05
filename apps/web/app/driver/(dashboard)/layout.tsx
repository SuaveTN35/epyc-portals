import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Search, Navigation, DollarSign, User } from 'lucide-react';

const navigation = [
  { name: 'Find Jobs', href: '/driver/jobs', icon: Search },
  { name: 'Active', href: '/driver/active', icon: Navigation },
  { name: 'Earnings', href: '/driver/earnings', icon: DollarSign },
  { name: 'Profile', href: '/driver/profile', icon: User },
];

export default async function DriverDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/driver/login');
  }

  // Get driver record
  const { data: driver } = await supabase
    .from('drivers')
    .select('*, profiles(*)')
    .eq('profile_id', user.id)
    .single();

  if (!driver) {
    redirect('/driver/onboarding');
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Top Header */}
      <header className="bg-epyc-primary text-white px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/images/logo.png" alt="EPYC" width={40} height={27} />
            <span className="font-bold">Driver</span>
          </Link>
          <div className="flex items-center space-x-3">
            {/* Online Status Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm">{driver.is_online ? 'Online' : 'Offline'}</span>
              <div
                className={`w-3 h-3 rounded-full ${
                  driver.is_online ? 'bg-green-400 status-pulse' : 'bg-gray-400'
                }`}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">{children}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex justify-around">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center py-2 px-4 text-gray-600 hover:text-epyc-primary transition-colors touch-target"
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
