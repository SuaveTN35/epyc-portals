import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';
import { DELIVERY_STATUS_CONFIG } from '@epyc/shared';
import type { Delivery, DeliveryStatus } from '@epyc/shared';

async function getDeliveries() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('deliveries')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

function getStatusIcon(status: DeliveryStatus) {
  switch (status) {
    case 'delivered':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'cancelled':
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'en_route_pickup':
    case 'en_route_delivery':
      return <Truck className="h-5 w-5 text-blue-500" />;
    default:
      return <Clock className="h-5 w-5 text-yellow-500" />;
  }
}

export default async function DeliveriesPage() {
  const deliveries = await getDeliveries();

  // Calculate stats
  const stats = {
    total: deliveries.length,
    active: deliveries.filter((d: Delivery) =>
      !['delivered', 'cancelled', 'failed', 'quote_requested', 'quoted'].includes(d.status)
    ).length,
    completed: deliveries.filter((d: Delivery) => d.status === 'delivered').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
          <p className="text-gray-600">Manage and track your deliveries</p>
        </div>
        <Link
          href="/deliveries/new"
          className="flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Delivery
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-epyc-primary" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Total Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Truck className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries</h2>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries yet</h3>
            <p className="text-gray-500 mb-6">Get started by creating your first delivery.</p>
            <Link
              href="/deliveries/new"
              className="inline-flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Delivery
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {deliveries.map((delivery: Delivery) => {
              const statusConfig = DELIVERY_STATUS_CONFIG[delivery.status];
              return (
                <Link
                  key={delivery.id}
                  href={`/deliveries/${delivery.id}`}
                  className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0">{getStatusIcon(delivery.status)}</div>
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {delivery.tracking_number}
                      </p>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span className="truncate">
                        {delivery.pickup_city}, {delivery.pickup_state} → {delivery.delivery_city},{' '}
                        {delivery.delivery_state}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(delivery.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    {delivery.total_price && (
                      <p className="text-sm font-semibold text-gray-900">
                        ${delivery.total_price.toFixed(2)}
                      </p>
                    )}
                    {delivery.distance_miles && (
                      <p className="text-xs text-gray-500">{delivery.distance_miles.toFixed(1)} mi</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
