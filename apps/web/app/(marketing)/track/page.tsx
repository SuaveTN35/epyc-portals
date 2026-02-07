'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, Package, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function PublicTrackPage() {
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

    window.location.href = `/client/deliveries/${data.id}`;
  };

  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Package className="h-16 w-16 mx-auto mb-6 text-yellow-300" />
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Track Your Delivery
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Enter your tracking number to see real-time updates on your package.
            </p>

            {/* Tracking Form */}
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-left">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                    placeholder="e.g., EPYC1A2B3C4D"
                    className="w-full px-4 py-3 pr-12 border-0 rounded-lg text-gray-900 text-lg uppercase focus:ring-2 focus:ring-yellow-300"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !trackingNumber.trim()}
                  className="px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-semibold hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              How Tracking Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-epyc-primary font-bold text-lg">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Enter Tracking Number</h3>
              <p className="text-gray-600 text-sm">
                Your tracking number starts with &quot;EPYC&quot; and was provided when your delivery was booked.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-epyc-primary font-bold text-lg">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">View Live Updates</h3>
              <p className="text-gray-600 text-sm">
                See real-time GPS location, estimated delivery time, and status updates.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-epyc-primary font-bold text-lg">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Get Confirmation</h3>
              <p className="text-gray-600 text-sm">
                Receive proof of delivery with signature, photo, and timestamp.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">
              Don&apos;t have a tracking number? Sign in to view all your deliveries.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/client/login" className="btn btn-primary">
                Sign in to Client Portal
              </Link>
              <a href="tel:8182170070" className="btn btn-secondary inline-flex items-center justify-center">
                <Phone className="mr-2 h-4 w-4" />
                Call (818) 217-0070
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
