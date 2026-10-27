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
  Link2,
  Plus,
} from 'lucide-react';
import { formatCurrency } from '@epyc/shared/utils';
import {
  ASSIGNABLE_STATUSES,
  AWAITING_ASSIGNMENT_STATUSES,
  DELIVERY_STATUSES,
  deliveryStatusBadge,
  deliveryStatusLabel,
} from '@/lib/delivery-status';

interface Delivery {
  id: string;
  tracking_number: string;
  status: string;
  service_level: string;
  pickup_address: string;
  delivery_address: string;
  pickup_contact_name: string;
  delivery_contact_name: string;
  total_price: number | null;
  distance_miles: number;
  created_at: string;
  pickup_window_start: string | null;
  driver_id: string | null;
  driver_name: string | null;
  customer_name: string | null;
  requires_signature: boolean;
  is_fragile: boolean;
  is_hipaa: boolean;
  broker_name: string | null;
  broker_type: string | null;
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
  ...DELIVERY_STATUSES.map((s) => ({ value: s, label: deliveryStatusLabel(s) })),
];

const serviceOptions = [
  { value: 'all', label: 'All Services' },
  { value: 'standard', label: 'Standard' },
  { value: 'priority', label: 'Priority' },
  { value: 'rush', label: 'Rush' },
  { value: 'scheduled', label: 'Scheduled' },
];

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  quote_requested: AlertCircle,
  quoted: AlertCircle,
  booked: AlertCircle,
  assigned: User,
  en_route_pickup: Truck,
  arrived_pickup: MapPin,
  picked_up: Package,
  en_route_delivery: Truck,
  arrived_delivery: MapPin,
  delivered: CheckCircle,
  cancelled: XCircle,
  failed: XCircle,
};

export default function DeliveriesPage() {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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
        total_price,
        distance_miles,
        created_at,
        pickup_window_start,
        driver_id,
        requires_signature,
        is_fragile,
        is_hipaa,
        driver:drivers!driver_id(profiles(full_name)),
        customer:profiles!customer_id(full_name),
        broker_deliveries(broker:brokers(name, type))
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
          total_price: d.total_price,
          distance_miles: d.distance_miles,
          created_at: d.created_at,
          pickup_window_start: d.pickup_window_start,
          driver_id: d.driver_id,
          driver_name: d.driver?.profiles?.full_name || null,
          customer_name: d.customer?.full_name || null,
          requires_signature: d.requires_signature,
          is_fragile: d.is_fragile,
          is_hipaa: d.is_hipaa,
          broker_name: d.broker_deliveries?.[0]?.broker?.name || null,
          broker_type: d.broker_deliveries?.[0]?.broker?.type || null,
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
      .eq('status', 'active')
      .order('is_online', { ascending: false });

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
    setAssignError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const previousDriverId = selectedDelivery.driver_id;

    // Update delivery with driver assignment. The status-change trigger logs
    // the booked -> assigned transition in delivery_events automatically.
    const { error: deliveryError } = await supabase
      .from('deliveries')
      .update({
        driver_id: driverId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', selectedDelivery.id);

    if (deliveryError) {
      setAssignError(deliveryError.message);
      setAssigning(false);
      return;
    }

    // A direct assignment closes any open offers for this job.
    await supabase
      .from('job_offers')
      .update({ status: 'expired' })
      .eq('delivery_id', selectedDelivery.id)
      .eq('status', 'pending');

    // Release the previous driver on a reassignment.
    if (previousDriverId && previousDriverId !== driverId) {
      await supabase
        .from('drivers')
        .update({ current_delivery_id: null })
        .eq('id', previousDriverId)
        .eq('current_delivery_id', selectedDelivery.id);
    }

    const { error: driverError } = await supabase
      .from('drivers')
      .update({ current_delivery_id: selectedDelivery.id })
      .eq('id', driverId);

    // Record who assigned it (context the status trigger does not capture).
    const { error: eventError } = await supabase.from('delivery_events').insert({
      delivery_id: selectedDelivery.id,
      event_type: 'driver_assigned',
      old_status: selectedDelivery.status,
      new_status: 'assigned',
      notes: previousDriverId && previousDriverId !== driverId
        ? 'Driver reassigned by dispatcher'
        : 'Driver assigned by dispatcher',
      created_by: user?.id ?? null,
    });

    if (driverError || eventError) {
      // The assignment itself succeeded; surface the follow-up failure.
      setAssignError(
        `Driver assigned, but a follow-up update failed: ${(driverError || eventError)?.message}`
      );
    } else {
      setShowAssignModal(false);
      setSelectedDelivery(null);
    }
    fetchDeliveries();
    fetchAvailableDrivers();

    setAssigning(false);
  };

  // Open the assign modal when arriving from a detail page (?assign=<id>).
  useEffect(() => {
    if (typeof window === 'undefined' || deliveries.length === 0) return;
    const assignId = new URLSearchParams(window.location.search).get('assign');
    if (!assignId) return;
    const target = deliveries.find((d) => d.id === assignId);
    if (target && ASSIGNABLE_STATUSES.includes(target.status as any)) {
      setSelectedDelivery(target);
      setAssignError(null);
      setShowAssignModal(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [deliveries]);

  const filteredDeliveries = deliveries.filter((delivery) => {
    // Source filter
    if (sourceFilter === 'broker' && !delivery.broker_name) return false;
    if (sourceFilter === 'direct' && delivery.broker_name) return false;

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      delivery.tracking_number.toLowerCase().includes(query) ||
      delivery.pickup_address.toLowerCase().includes(query) ||
      delivery.delivery_address.toLowerCase().includes(query) ||
      delivery.pickup_contact_name?.toLowerCase().includes(query) ||
      delivery.delivery_contact_name?.toLowerCase().includes(query) ||
      delivery.customer_name?.toLowerCase().includes(query) ||
      delivery.broker_name?.toLowerCase().includes(query)
    );
  });

  const pendingCount = deliveries.filter((d) => AWAITING_ASSIGNMENT_STATUSES.includes(d.status as any)).length;

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
        <div className="flex gap-2">
          <button
            onClick={() => fetchDeliveries()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <Link
            href="/dispatch/deliveries/new"
            className="inline-flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Link>
        </div>
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
            onClick={() => setStatusFilter('booked')}
            className="text-sm font-medium text-yellow-800 hover:text-yellow-900"
          >
            View Pending {'->'}
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
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
            >
              <option value="all">All Sources</option>
              <option value="direct">Direct</option>
              <option value="broker">Broker</option>
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
                          href={`/dispatch/deliveries/${delivery.id}`}
                          className="font-medium text-epyc-primary hover:text-blue-700"
                        >
                          {delivery.tracking_number}
                        </Link>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {delivery.broker_name && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-cyan-100 text-cyan-700 rounded">
                              <Link2 className="h-2.5 w-2.5" />
                              {delivery.broker_name}
                            </span>
                          )}
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
                          className={`status-badge border ${deliveryStatusBadge(delivery.status)}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {deliveryStatusLabel(delivery.status)}
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
                              {'->'} {delivery.delivery_address.split(',')[0]}
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
                        {delivery.total_price != null ? formatCurrency(delivery.total_price) : '-'}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dispatch/deliveries/${delivery.id}`}
                            className="text-sm text-gray-600 hover:text-gray-900"
                          >
                            View
                          </Link>
                          {ASSIGNABLE_STATUSES.includes(delivery.status as any) && (
                            <button
                              onClick={() => {
                                setSelectedDelivery(delivery);
                                setAssignError(null);
                                setShowAssignModal(true);
                              }}
                              className="text-sm text-epyc-primary hover:text-blue-700 font-medium"
                            >
                              {delivery.driver_id ? 'Reassign' : 'Assign'}
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

            {assignError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 text-sm text-red-700">
                {assignError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableDrivers.length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No active drivers</p>
                  <p className="text-xs text-gray-400">
                    Approve a driver on the Drivers or Applications page first
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
                    {driver.current_delivery_id ? (
                      <span className="text-xs text-orange-600 font-medium">On a job</span>
                    ) : driver.is_online ? (
                      <span className="text-xs text-green-600 font-medium">Online</span>
                    ) : (
                      <span className="text-xs text-gray-500 font-medium">Offline</span>
                    )}
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
