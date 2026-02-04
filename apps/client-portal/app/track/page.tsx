'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function TrackPage() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: queryError } = await supabase
      .from('deliveries')
      .select('id')
      .eq('tracking_number', trackingNumber.trim().toUpperCase())
      .single();

    if (queryError || !data) {
      setError('Tracking number not found. Please check and try again.');
      setLoading(false);
      return;
    }

    // Redirect to tracking page
    window.location.href = `/track/${trackingNumber.trim().toUpperCase()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-epyc-green via-epyc-teal to-epyc-blue flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex flex-col items-center mb-8">
        <Image src="/images/logo.png" alt="EPYC Courier Service" width={100} height={67} className="mb-2" />
        <span className="text-xl font-bold text-white drop-shadow-md">Track Package</span>
      </Link>

      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Track Your Package</h1>
        <p className="text-gray-600 text-center mb-6">
          Enter your tracking number to see real-time updates.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
              placeholder="e.g., EPYC1A2B3C4D"
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-lg uppercase"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !trackingNumber.trim()}
            className="w-full mt-4 flex items-center justify-center px-6 py-3 bg-epyc-primary text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Track Package'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t have a tracking number?{' '}
            <Link href="/login" className="text-epyc-primary hover:text-epyc-secondary font-medium">
              Sign in
            </Link>{' '}
            to view your deliveries.
          </p>
        </div>
      </div>

      <div className="mt-8 text-center text-white/80 text-sm">
        <p>Need help? Call us at (818) 217-0070</p>
      </div>
    </div>
  );
}
