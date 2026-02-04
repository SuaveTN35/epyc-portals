import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Package, MapPin, Clock, ChevronRight, Navigation } from 'lucide-react';
import { DELIVERY_STATUS_CONFIG, formatDuration } from '@epyc/shared';
import type { Delivery } from '@epyc/shared';

export default async function ActiveDeliveriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get driver record
  const { data: driver } = await supabase
    .from('drivers')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (!driver) {
    redirect('/onboarding');
  }

  // Get active deliveries
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('*')
    .eq('driver_id', driver.id)
    .in('status', ['assigned', 'en_route_pickup', 'arrived_pickup', 'picked_up', 'en_route_delivery', 'arrived_delivery'])
    .order('assigned_at', { ascending: false });

  const activeDeliveries = (deliveries || []) as Delivery[];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Active Deliveries</h1>

      {activeDeliveries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-2">No Active Deliveries</h3>
          <p className="text-gray-500 text-sm mb-4">
            Accept a job from the Jobs tab to get started.
          </p>
          <Link
            href="/jobs"
            className="inline-flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg font-medium"
          >
            Find Jobs
            <ChevronRight className="h-5 w-5 ml-1" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {activeDeliveries.map((delivery) => {
            const statusConfig = DELIVERY_STATUS_CONFIG[delivery.status];
            const isPickupPhase = ['assigned', 'en_route_pickup', 'arrived_pickup'].includes(delivery.status);

            return (
              <Link
                key={delivery.id}
                href={`/delivery/${delivery.id}`}
                className="block bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {/* Status Bar */}
                <div className={`px-4 py-2 ${statusConfig.bgColor}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                    <span className="text-sm text-gray-600">
                      {delivery.tracking_number}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  {/* Current Destination */}
                  <div className="flex items-start mb-4">
                    <div className="bg-epyc-primary/10 p-2 rounded-lg mr-3">
                      <Navigation className="h-6 w-6 text-epyc-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        {isPickupPhase ? 'Pickup at' : 'Deliver to'}
                      </p>
                      <p className="font-medium text-gray-900">
                        {isPickupPhase ? delivery.pickup_address : delivery.delivery_address}
                      </p>
                      <p className="text-sm text-gray-500">
                        {isPickupPhase
                          ? `${delivery.pickup_city}, ${delivery.pickup_state}`
                          : `${delivery.delivery_city}, ${delivery.delivery_state}`}
                      </p>
                    </div>
                    <ChevronRight className="h-6 w-6 text-gray-400" />
                  </div>

                  {/* Route Summary */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {delivery.distance_miles?.toFixed(1)} mi total
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatDuration(delivery.estimated_duration_minutes || 0)}
                    </div>
                  </div>

                  {/* Payout */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Your payout</span>
                    <span className="text-lg font-bold text-epyc-primary">
                      ${delivery.driver_payout?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
