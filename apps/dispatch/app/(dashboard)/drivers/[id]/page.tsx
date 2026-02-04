'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  User,
  Truck,
  Star,
  Package,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  Shield,
  Snowflake,
  FileText,
  Calendar,
  Clock,
  Award,
  TrendingUp,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@epyc/shared/utils';

interface DriverDetail {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string;
  license_plate: string;
  drivers_license_number: string;
  drivers_license_expiry: string;
  insurance_provider: string;
  insurance_policy_number: string;
  insurance_expiry: string;
  status: string;
  is_online: boolean;
  is_hipaa_certified: boolean;
  has_cold_storage: boolean;
  current_delivery_id: string | null;
  total_deliveries: number;
  total_earnings: number;
  rating: number;
  loyalty_tier: string;
  created_at: string;
  last_active_at: string | null;
  available_balance: number;
}

interface DeliveryHistory {
  id: string;
  tracking_number: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  driver_payout: number;
  delivered_at: string | null;
  created_at: string;
}

interface WeeklyStats {
  deliveries: number;
  earnings: number;
  rating: number;
  hoursActive: number;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  suspended: 'bg-red-100 text-red-800 border-red-300',
  inactive: 'bg-gray-100 text-gray-800 border-gray-300',
};

const tierColors: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

export default function DriverDetailPage() {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryHistory[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    deliveries: 0,
    earnings: 0,
    rating: 0,
    hoursActive: 0,
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDriverDetails();
    }
  }, [params.id]);

  const fetchDriverDetails = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch driver details
    const { data: driverData } = await supabase
      .from('drivers')
      .select(`
        *,
        profiles(full_name, email, phone)
      `)
      .eq('id', params.id)
      .single();

    if (driverData) {
      // Get available balance from payouts
      const { data: payoutData } = await supabase
        .from('driver_payouts')
        .select('amount')
        .eq('driver_id', params.id)
        .eq('status', 'pending');

      const availableBalance = payoutData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      setDriver({
        ...driverData,
        full_name: driverData.profiles?.full_name || 'Unknown Driver',
        email: driverData.profiles?.email || '',
        phone: driverData.profiles?.phone || '',
        available_balance: availableBalance,
      });

      // Fetch delivery history
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('id, tracking_number, status, pickup_address, delivery_address, driver_payout, delivered_at, created_at')
        .eq('driver_id', params.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (deliveries) {
        setDeliveryHistory(deliveries);
      }

      // Calculate weekly stats
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: weekDeliveries } = await supabase
        .from('deliveries')
        .select('driver_payout, delivered_at')
        .eq('driver_id', params.id)
        .eq('status', 'delivered')
        .gte('delivered_at', weekAgo.toISOString());

      const { data: weekRatings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('driver_id', params.id)
        .gte('created_at', weekAgo.toISOString());

      const weeklyEarnings = weekDeliveries?.reduce((sum, d) => sum + (d.driver_payout || 0), 0) || 0;
      const avgRating = weekRatings?.length
        ? weekRatings.reduce((sum, r) => sum + r.rating, 0) / weekRatings.length
        : driverData.rating;

      setWeeklyStats({
        deliveries: weekDeliveries?.length || 0,
        earnings: weeklyEarnings,
        rating: avgRating,
        hoursActive: Math.round((weekDeliveries?.length || 0) * 0.75), // Estimate
      });
    }

    setLoading(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!driver) return;
    if (newStatus === 'suspended' && !confirm('Are you sure you want to suspend this driver?')) return;

    setUpdating(true);
    const supabase = createClient();

    await supabase
      .from('drivers')
      .update({
        status: newStatus,
        is_online: newStatus !== 'active' ? false : driver.is_online,
      })
      .eq('id', driver.id);

    fetchDriverDetails();
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">Driver not found</p>
        <Link
          href="/drivers"
          className="mt-4 inline-flex items-center text-epyc-primary hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Drivers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/drivers"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 bg-epyc-primary rounded-full flex items-center justify-center">
                <span className="text-2xl font-medium text-white">
                  {driver.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              {driver.is_online && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{driver.full_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`status-badge border ${statusColors[driver.status]}`}>
                  {driver.status}
                </span>
                <span className={`status-badge ${tierColors[driver.loyalty_tier]}`}>
                  <Award className="h-3 w-3 mr-1" />
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
                    Cold Storage
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {driver.status === 'pending' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={updating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Approve Driver
            </button>
          )}
          {driver.status === 'suspended' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={updating}
              className="px-4 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Reactivate
            </button>
          )}
          {driver.status === 'active' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              disabled={updating}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Suspend Driver
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Star className="h-4 w-4 text-yellow-500" />
            Rating
          </div>
          <p className="text-2xl font-bold">{driver.rating.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Package className="h-4 w-4" />
            Total Deliveries
          </div>
          <p className="text-2xl font-bold">{driver.total_deliveries}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="h-4 w-4 text-green-500" />
            Total Earnings
          </div>
          <p className="text-2xl font-bold">{formatCurrency(driver.total_earnings / 100)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="h-4 w-4 text-blue-500" />
            Available Balance
          </div>
          <p className="text-2xl font-bold">{formatCurrency(driver.available_balance / 100)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">This Week</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{weeklyStats.deliveries}</p>
                <p className="text-sm text-gray-500">Deliveries</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(weeklyStats.earnings / 100)}
                </p>
                <p className="text-sm text-gray-500">Earnings</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{weeklyStats.rating.toFixed(1)}</p>
                <p className="text-sm text-gray-500">Avg Rating</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{weeklyStats.hoursActive}h</p>
                <p className="text-sm text-gray-500">Active Hours</p>
              </div>
            </div>
          </div>

          {/* Recent deliveries */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th>Tracking</th>
                    <th>Status</th>
                    <th>Route</th>
                    <th>Payout</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deliveryHistory.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td>
                        <Link
                          href={`/deliveries/${delivery.id}`}
                          className="font-medium text-epyc-primary hover:text-blue-700"
                        >
                          {delivery.tracking_number}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            delivery.status === 'delivered'
                              ? 'bg-green-100 text-green-800'
                              : delivery.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {delivery.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="max-w-[150px]">
                        <p className="text-xs text-gray-500 truncate">
                          {delivery.pickup_address.split(',')[0]}
                        </p>
                        <p className="text-xs text-gray-700 truncate">
                          → {delivery.delivery_address.split(',')[0]}
                        </p>
                      </td>
                      <td className="font-medium text-green-600">
                        {formatCurrency(delivery.driver_payout / 100)}
                      </td>
                      <td className="text-sm text-gray-500">
                        {new Date(delivery.delivered_at || delivery.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {deliveryHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        No delivery history
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <a
                  href={`mailto:${driver.email}`}
                  className="text-epyc-primary hover:text-blue-700"
                >
                  {driver.email}
                </a>
              </div>
              {driver.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <a
                    href={`tel:${driver.phone}`}
                    className="text-epyc-primary hover:text-blue-700"
                  >
                    {driver.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehicle</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="capitalize">{driver.vehicle_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Make/Model</span>
                <span>{driver.vehicle_make} {driver.vehicle_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Year</span>
                <span>{driver.vehicle_year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Color</span>
                <span className="capitalize">{driver.vehicle_color}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">License Plate</span>
                <span className="font-mono">{driver.license_plate}</span>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Driver's License</p>
                <p className="font-mono text-sm">{driver.drivers_license_number}</p>
                <p className="text-xs text-gray-500">
                  Expires: {new Date(driver.drivers_license_expiry).toLocaleDateString()}
                </p>
                {new Date(driver.drivers_license_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                  <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    Expiring soon
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Insurance</p>
                <p className="text-sm">{driver.insurance_provider}</p>
                <p className="font-mono text-xs">{driver.insurance_policy_number}</p>
                <p className="text-xs text-gray-500">
                  Expires: {new Date(driver.insurance_expiry).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Member Since</span>
                <span>{new Date(driver.created_at).toLocaleDateString()}</span>
              </div>
              {driver.last_active_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Active</span>
                  <span>{new Date(driver.last_active_at).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Current Status</span>
                <span>
                  {driver.current_delivery_id ? (
                    <Link
                      href={`/deliveries/${driver.current_delivery_id}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      On Delivery
                    </Link>
                  ) : driver.is_online ? (
                    <span className="text-green-600">Available</span>
                  ) : (
                    <span className="text-gray-500">Offline</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
