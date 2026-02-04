'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Package,
  Search,
  Filter,
  ChevronDown,
  MapPin,
  Clock,
  User,
  Truck,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@epyc/shared/utils';

interface Delivery {
  id: string;
  tracking_number: string;
  status: string;
  service_level: string;
  pickup_address: string;
  delivery_address: string;
  pickup_contact_name: string;
  delivery_contact_name: string;
  total_amount: number;
  distance_miles: number;
  created_at: string;
  scheduled_pickup: string | null;
  driver_id: string | null;
  driver_name: string | null;
  customer_name: string | null;
  requires_signature: boolean;
  is_fragile: boolean;
  is_hipaa: boolean;
}

interface Driver {
  id: string;
  full_name: string;
  vehicle_type: string;
  is_online: boolean;
  current_delivery_id: string | null;
}

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const serviceOptions = [
  { value: 'all', label: 'All Services' },
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'rush', label: 'Rush' },
  { value: 'same_day', label: 'Same Day' },
  { value: 'scheduled', label: 'Scheduled' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  assigned: 'bg-blue-100 text-blue-800 border-blue-200',
  picked_up: 'bg-purple-100 text-purple-800 border-purple-200',
  in_transit: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: AlertCircle,
  assigned: User,
  picked_up: Package,
  in_transit: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

export default function DeliveriesPage() {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchDeliveries();
    fetchAvailableDrivers();

    const supabase = createClient();
    const subscription = supabase
      .channel('deliveries-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => fetchDeliveries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [statusFilter, serviceFilter]);

  const fetchDeliveries = async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        status,
        service_level,
        pickup_address,
        delivery_address,
        pickup_contact_name,
        delivery_contact_name,
        total_amount,
        distance_miles,
        created_at,
        scheduled_pickup,
        driver_id,
        requires_signature,
        is_fragile,
        is_hipaa,
        driver:drivers(profiles(full_name)),
        customer:profiles!deliveries_customer_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (serviceFilter !== 'all') {
      query = query.eq('service_level', serviceFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setDeliveries(
        data.map((d: any) => ({
          id: d.id,
          tracking_number: d.tracking_number,
          status: d.status,
          service_level: d.service_level,
          pickup_address: d.pickup_address,
          delivery_address: d.delivery_address,
          pickup_contact_name: d.pickup_contact_name,
          delivery_contact_name: d.delivery_contact_name,
          total_amount: d.total_amount,
          distance_miles: d.distance_miles,
          created_at: d.created_at,
          scheduled_pickup: d.scheduled_pickup,
          driver_id: d.driver_id,
          driver_name: d.driver?.profiles?.full_name || null,
          customer_name: d.customer?.full_name || null,
          requires_signature: d.requires_signature,
          is_fragile: d.is_fragile,
          is_hipaa: d.is_hipaa,
        }))
      );
    }

    setLoading(false);
  };

  const fetchAvailableDrivers = async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from('drivers')
      .select(`
        id,
        vehicle_type,
        is_online,
        current_delivery_id,
        profiles(full_name)
      `)
      .eq('is_online', true)
      .eq('status', 'active')
      .is('current_delivery_id', null);

    if (data) {
      setAvailableDrivers(
        data.map((d: any) => ({
          id: d.id,
          full_name: d.profiles?.full_name || 'Unknown',
          vehicle_type: d.vehicle_type,
          is_online: d.is_online,
          current_delivery_id: d.current_delivery_id,
        }))
      );
    }
  };

  const handleAssignDriver = async (driverId: string) => {
    if (!selectedDelivery) return;

    setAssigning(true);
    const supabase = createClient();

    // Update delivery with driver assignment
    const { error: deliveryError } = await supabase
      .from('deliveries')
      .update({
        driver_id: driverId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', selectedDelivery.id);

    if (!deliveryError) {
      // Update driver's current delivery
      await supabase
        .from('drivers')
        .update({ current_delivery_id: selectedDelivery.id })
        .eq('id', driverId);

      // Create delivery event
      await supabase.from('delivery_events').insert({
        delivery_id: selectedDelivery.id,
        event_type: 'assigned',
        description: 'Driver assigned by dispatcher',
      });

      setShowAssignModal(false);
      setSelectedDelivery(null);
      fetchDeliveries();
      fetchAvailableDrivers();
    }

    setAssigning(false);
  };

  const filteredDeliveries = deliveries.filter((delivery) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      delivery.tracking_number.toLowerCase().includes(query) ||
      delivery.pickup_address.toLowerCase().includes(query) ||
      delivery.delivery_address.toLowerCase().includes(query) ||
      delivery.pickup_contact_name?.toLowerCase().includes(query) ||
      delivery.delivery_contact_name?.toLowerCase().includes(query) ||
      delivery.customer_name?.toLowerCase().includes(query)
    );
  });

  const pendingCount = deliveries.filter((d) => d.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
          <p className="text-sm text-gray-500">
            Manage and track all delivery orders
          </p>
        </div>
        <button
          onClick={() => fetchDeliveries()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {pendingCount} delivery{pendingCount > 1 ? 's' : ''} awaiting assignment
              </p>
              <p className="text-sm text-yellow-700">
                Assign drivers to pending deliveries to begin fulfillment
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            className="text-sm font-medium text-yellow-800 hover:text-yellow-900"
          >
            View Pending →
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tracking #, address, or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Deliveries table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No deliveries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead className="bg-gray-50">
                <tr>
                  <th>Tracking #</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Route</th>
                  <th>Driver</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDeliveries.map((delivery) => {
                  const StatusIcon = statusIcons[delivery.status] || Package;
                  return (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td>
                        <Link
                          href={`/deliveries/${delivery.id}`}
                          className="font-medium text-epyc-primary hover:text-blue-700"
                        >
                          {delivery.tracking_number}
                        </Link>
                        <div className="flex items-center gap-1 mt-1">
                          {delivery.is_hipaa && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">
                              HIPAA
                            </span>
                          )}
                          {delivery.is_fragile && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">
                              Fragile
                            </span>
                          )}
                          {delivery.requires_signature && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
                              Signature
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-badge border ${statusColors[delivery.status]}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {delivery.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="capitalize text-sm">
                          {delivery.service_level.replace('_', ' ')}
                        </span>
                        <p className="text-xs text-gray-500">
                          {delivery.distance_miles.toFixed(1)} mi
                        </p>
                      </td>
                      <td className="max-w-[200px]">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500 truncate">
                              {delivery.pickup_address.split(',')[0]}
                            </p>
                            <p className="text-xs text-gray-700 truncate">
                              → {delivery.delivery_address.split(',')[0]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {delivery.driver_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-epyc-primary rounded-full flex items-center justify-center">
                              <span className="text-xs text-white">
                                {delivery.driver_name.charAt(0)}
                              </span>
                            </div>
                            <span className="text-sm">{delivery.driver_name}</span>
                          </div>
                        ) : (
                          <span className="text-yellow-600 text-sm">Unassigned</span>
                        )}
                      </td>
                      <td className="font-medium">
                        {formatCurrency(delivery.total_amount / 100)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/deliveries/${delivery.id}`}
                            className="text-sm text-gray-600 hover:text-gray-900"
                          >
                            View
                          </Link>
                          {delivery.status === 'pending' && (
                            <button
                              onClick={() => {
                                setSelectedDelivery(delivery);
                                setShowAssignModal(true);
                              }}
                              className="text-sm text-epyc-primary hover:text-blue-700 font-medium"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Driver Modal */}
      {showAssignModal && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAssignModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Driver
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select an available driver for delivery{' '}
              <span className="font-medium">{selectedDelivery.tracking_number}</span>
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableDrivers.length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No drivers available</p>
                  <p className="text-xs text-gray-400">
                    All drivers are offline or on delivery
                  </p>
                </div>
              ) : (
                availableDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => handleAssignDriver(driver.id)}
                    disabled={assigning}
                    className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-epyc-primary hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-epyc-primary rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {driver.full_name.charAt(0)}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">
                          {driver.full_name}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {driver.vehicle_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-green-600 font-medium">
                      Available
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
