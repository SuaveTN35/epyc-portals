'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  Search,
  Truck,
  Star,
  Package,
  DollarSign,
  MapPin,
  Phone,
  Shield,
  Snowflake,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@epyc/shared/utils';

interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  license_plate: string;
  status: string;
  is_online: boolean;
  is_hipaa_certified: boolean;
  has_cold_storage: boolean;
  current_delivery_id: string | null;
  total_deliveries: number;
  rating: number;
  loyalty_tier: string;
  created_at: string;
  earnings_today: number;
  deliveries_today: number;
}

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
];

const vehicleOptions = [
  { value: 'all', label: 'All Vehicles' },
  { value: 'car', label: 'Car' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'box_truck', label: 'Box Truck' },
  { value: 'motorcycle', label: 'Motorcycle' },
];

const tierColors: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-800',
};

export default function DriversPage() {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);

  useEffect(() => {
    fetchDrivers();

    const supabase = createClient();
    const subscription = supabase
      .channel('drivers-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => fetchDrivers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [statusFilter, vehicleFilter, onlineOnly]);

  const fetchDrivers = async () => {
    setLoading(true);
    const supabase = createClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = supabase
      .from('drivers')
      .select(`
        id,
        user_id,
        vehicle_type,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        license_plate,
        status,
        is_online,
        is_hipaa_certified,
        has_cold_storage,
        current_delivery_id,
        total_deliveries,
        rating,
        loyalty_tier,
        created_at,
        profiles(full_name, email, phone)
      `)
      .order('is_online', { ascending: false })
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (vehicleFilter !== 'all') {
      query = query.eq('vehicle_type', vehicleFilter);
    }

    if (onlineOnly) {
      query = query.eq('is_online', true);
    }

    const { data: driversData } = await query;

    if (driversData) {
      // Get today's earnings and deliveries for each driver
      const driverIds = driversData.map((d: any) => d.id);

      const { data: todayDeliveries } = await supabase
        .from('deliveries')
        .select('driver_id, driver_payout')
        .in('driver_id', driverIds)
        .gte('delivered_at', today.toISOString())
        .eq('status', 'delivered');

      const earningsByDriver: Record<string, number> = {};
      const deliveriesByDriver: Record<string, number> = {};

      todayDeliveries?.forEach((d: any) => {
        earningsByDriver[d.driver_id] = (earningsByDriver[d.driver_id] || 0) + (d.driver_payout || 0);
        deliveriesByDriver[d.driver_id] = (deliveriesByDriver[d.driver_id] || 0) + 1;
      });

      setDrivers(
        driversData.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          full_name: d.profiles?.full_name || 'Unknown Driver',
          email: d.profiles?.email || '',
          phone: d.profiles?.phone || '',
          vehicle_type: d.vehicle_type,
          vehicle_make: d.vehicle_make,
          vehicle_model: d.vehicle_model,
          vehicle_year: d.vehicle_year,
          license_plate: d.license_plate,
          status: d.status,
          is_online: d.is_online,
          is_hipaa_certified: d.is_hipaa_certified,
          has_cold_storage: d.has_cold_storage,
          current_delivery_id: d.current_delivery_id,
          total_deliveries: d.total_deliveries,
          rating: d.rating,
          loyalty_tier: d.loyalty_tier,
          created_at: d.created_at,
          earnings_today: earningsByDriver[d.id] || 0,
          deliveries_today: deliveriesByDriver[d.id] || 0,
        }))
      );
    }

    setLoading(false);
  };

  const handleApproveDriver = async (driverId: string) => {
    const supabase = createClient();
    await supabase
      .from('drivers')
      .update({ status: 'active' })
      .eq('id', driverId);
    fetchDrivers();
  };

  const handleSuspendDriver = async (driverId: string) => {
    if (!confirm('Are you sure you want to suspend this driver?')) return;
    const supabase = createClient();
    await supabase
      .from('drivers')
      .update({ status: 'suspended', is_online: false })
      .eq('id', driverId);
    fetchDrivers();
  };

  const filteredDrivers = drivers.filter((driver) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      driver.full_name.toLowerCase().includes(query) ||
      driver.email.toLowerCase().includes(query) ||
      driver.phone?.includes(query) ||
      driver.license_plate?.toLowerCase().includes(query)
    );
  });

  const onlineCount = drivers.filter((d) => d.is_online).length;
  const pendingCount = drivers.filter((d) => d.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-sm text-gray-500">
            Manage driver accounts and track their activity
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>{onlineCount} Online</span>
          </div>
          <button
            onClick={() => fetchDrivers()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Pending approval alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {pendingCount} driver{pendingCount > 1 ? 's' : ''} pending approval
              </p>
              <p className="text-sm text-yellow-700">
                Review applications to activate new driver accounts
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
              placeholder="Search by name, email, phone, or license plate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
            />
          </div>
          <div className="flex flex-wrap gap-4">
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
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
            >
              {vehicleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(e) => setOnlineOnly(e.target.checked)}
                className="rounded text-epyc-primary focus:ring-epyc-primary"
              />
              <span className="text-sm">Online Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Drivers grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No drivers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => (
            <div
              key={driver.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-epyc-primary rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium text-white">
                        {driver.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {driver.is_online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <Link
                      href={`/dispatch/drivers/${driver.id}`}
                      className="font-medium text-gray-900 hover:text-epyc-primary"
                    >
                      {driver.full_name}
                    </Link>
                    <p className="text-sm text-gray-500 capitalize">
                      {driver.vehicle_type.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <span className={`status-badge ${statusColors[driver.status]}`}>
                  {driver.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span>
                    {driver.vehicle_year} {driver.vehicle_make} {driver.vehicle_model}
                  </span>
                </div>
                {driver.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{driver.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">{driver.rating.toFixed(1)}</span>
                  <span className="text-gray-400">•</span>
                  <Package className="h-4 w-4 text-gray-400" />
                  <span>{driver.total_deliveries} total</span>
                </div>
              </div>

              {/* Certifications */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`status-badge ${tierColors[driver.loyalty_tier]}`}>
                  {driver.loyalty_tier}
                </span>
                {driver.is_hipaa_certified && (
                  <span className="status-badge bg-red-100 text-red-800">
                    <Shield className="h-3 w-3 mr-1" />
                    HIPAA
                  </span>
                )}
                {driver.has_cold_storage && (
                  <span className="status-badge bg-blue-100 text-blue-800">
                    <Snowflake className="h-3 w-3 mr-1" />
                    Cold
                  </span>
                )}
              </div>

              {/* Today's stats */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Today</p>
                  <p className="text-sm font-medium">
                    {driver.deliveries_today} deliveries
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Earned</p>
                  <p className="text-sm font-medium text-green-600">
                    {formatCurrency(driver.earnings_today / 100)}
                  </p>
                </div>
              </div>

              {/* Current status */}
              <div className="pt-3 border-t border-gray-100">
                {driver.current_delivery_id ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600">On Delivery</span>
                    <Link
                      href={`/dispatch/deliveries/${driver.current_delivery_id}`}
                      className="text-xs text-epyc-primary hover:text-blue-700"
                    >
                      View →
                    </Link>
                  </div>
                ) : driver.is_online ? (
                  <span className="text-sm text-green-600">Available</span>
                ) : (
                  <span className="text-sm text-gray-500">Offline</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <Link
                  href={`/dispatch/drivers/${driver.id}`}
                  className="flex-1 px-3 py-2 text-sm text-center text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  View Profile
                </Link>
                {driver.status === 'pending' && (
                  <button
                    onClick={() => handleApproveDriver(driver.id)}
                    className="flex-1 px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                )}
                {driver.status === 'active' && (
                  <button
                    onClick={() => handleSuspendDriver(driver.id)}
                    className="px-3 py-2 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                  >
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
