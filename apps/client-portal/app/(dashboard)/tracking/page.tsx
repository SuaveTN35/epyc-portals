import Link from 'next/link';
import { MapPin, Truck, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DELIVERY_STATUS_CONFIG, formatDuration } from '@epyc/shared';
import type { DeliveryStatus } from '@epyc/shared';

async function getActiveDeliveries() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Get active deliveries (not delivered, cancelled, or failed)
  const { data } = await supabase
    .from('deliveries')
    .select(
      `
      *,
      driver:drivers(
        id,
        profiles:user_id(full_name, phone)
      )
    `
    )
    .eq('customer_id', user.id)
    .not('status', 'in', '("delivered","cancelled","failed")')
    .order('created_at', { ascending: false });

  return data || [];
}

export default async function TrackingPage() {
  const deliveries = await getActiveDeliveries();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Active Deliveries</h1>
          <p className="text-gray-600">Track your deliveries in real-time</p>
        </div>
        <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {deliveries.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No active deliveries
          </h3>
          <p className="text-gray-500 mb-6">
            All your deliveries have been completed or you haven&apos;t booked any yet
          </p>
          <Link
            href="/deliveries/new"
            className="inline-flex items-center px-6 py-3 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Book a Delivery
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery) => {
            const statusConfig =
              DELIVERY_STATUS_CONFIG[delivery.status as DeliveryStatus];
            const driverName = delivery.driver?.profiles?.full_name;

            return (
              <div
                key={delivery.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                {/* Status Bar */}
                <div
                  className={`h-1 ${
                    delivery.status.includes('en_route')
                      ? 'bg-epyc-primary animate-pulse'
                      : 'bg-gray-200'
                  }`}
                />

                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left: Tracking & Status */}
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${statusConfig.bgColor}`}
                      >
                        <Truck className={`h-6 w-6 ${statusConfig.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {delivery.tracking_number}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </div>
                        {driverName && (
                          <p className="text-sm text-gray-500 mt-1">
                            Driver: {driverName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Center: Route */}
                    <div className="flex-1 max-w-md">
                      <div className="flex items-center text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-500 text-xs">Pickup</p>
                          <p className="font-medium text-gray-900 truncate">
                            {delivery.pickup_address}
                          </p>
                          <p className="text-gray-500 truncate">
                            {delivery.pickup_city}, {delivery.pickup_state}
                          </p>
                        </div>
                        <div className="mx-4 flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <div className="w-0.5 h-8 bg-gray-200" />
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-500 text-xs">Delivery</p>
                          <p className="font-medium text-gray-900 truncate">
                            {delivery.delivery_address}
                          </p>
                          <p className="text-gray-500 truncate">
                            {delivery.delivery_city}, {delivery.delivery_state}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right: ETA & Actions */}
                    <div className="flex items-center gap-4">
                      {delivery.estimated_duration_minutes && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">ETA</p>
                          <p className="font-semibold text-gray-900 flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-gray-400" />
                            {formatDuration(delivery.estimated_duration_minutes)}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Link
                          href={`/deliveries/${delivery.id}`}
                          className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Details
                        </Link>
                        <Link
                          href={`/track?tracking=${delivery.tracking_number}`}
                          className="flex items-center px-3 py-2 text-sm font-medium text-epyc-primary border border-epyc-primary rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Track
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Public Tracking Input */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Track Another Package</h3>
        <p className="text-sm text-gray-600 mb-4">
          Enter a tracking number to track any EPYC delivery
        </p>
        <form className="flex gap-2" action="/track" method="GET">
          <input
            type="text"
            name="tracking"
            placeholder="Enter tracking number (e.g., EPYC1234)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
          />
          <button
            type="submit"
            className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Track
          </button>
        </form>
      </div>
    </div>
  );
}
