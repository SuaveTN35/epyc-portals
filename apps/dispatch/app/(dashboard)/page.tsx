'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Package,
  Truck,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  MapPin,
  Users,
  Loader2,
} from 'lucide-react';
import { formatCurrency, formatDistance } from '@epyc/shared/utils';

interface DashboardStats {
  activeDeliveries: number;
  onlineDrivers: number;
  todayRevenue: number;
  todayDeliveries: number;
  avgDeliveryTime: number;
  pendingAssignments: number;
}

interface RecentDelivery {
  id: string;
  tracking_number: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  driver_name: string | null;
  created_at: string;
  service_level: string;
}

interface DriverStatus {
  id: string;
  full_name: string;
  current_delivery_id: string | null;
  is_online: boolean;
  vehicle_type: string;
  completed_today: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeDeliveries: 0,
    onlineDrivers: 0,
    todayRevenue: 0,
    todayDeliveries: 0,
    avgDeliveryTime: 0,
    pendingAssignments: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState<RecentDelivery[]>([]);
  const [driverStatuses, setDriverStatuses] = useState<DriverStatus[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const fetchDashboardData = async () => {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch active deliveries count
      const { count: activeCount } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      // Fetch online drivers count
      const { count: onlineCount } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)
        .eq('status', 'active');

      // Fetch today's revenue
      const { data: todayPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('created_at', today.toISOString())
        .eq('status', 'completed');

      const todayRevenue = todayPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Fetch today's completed deliveries count
      const { count: todayDeliveriesCount } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .gte('delivered_at', today.toISOString())
        .eq('status', 'delivered');

      // Fetch pending assignments count
      const { count: pendingCount } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch average delivery time for today
      const { data: completedToday } = await supabase
        .from('deliveries')
        .select('picked_up_at, delivered_at')
        .gte('delivered_at', today.toISOString())
        .eq('status', 'delivered')
        .not('picked_up_at', 'is', null);

      let avgTime = 0;
      if (completedToday && completedToday.length > 0) {
        const totalMinutes = completedToday.reduce((sum, d) => {
          const pickup = new Date(d.picked_up_at!).getTime();
          const delivery = new Date(d.delivered_at!).getTime();
          return sum + (delivery - pickup) / (1000 * 60);
        }, 0);
        avgTime = Math.round(totalMinutes / completedToday.length);
      }

      setStats({
        activeDeliveries: activeCount || 0,
        onlineDrivers: onlineCount || 0,
        todayRevenue,
        todayDeliveries: todayDeliveriesCount || 0,
        avgDeliveryTime: avgTime,
        pendingAssignments: pendingCount || 0,
      });

      // Fetch recent deliveries
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select(`
          id,
          tracking_number,
          status,
          pickup_address,
          delivery_address,
          service_level,
          created_at,
          driver:drivers(profiles(full_name))
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (deliveries) {
        setRecentDeliveries(
          deliveries.map((d: any) => ({
            id: d.id,
            tracking_number: d.tracking_number,
            status: d.status,
            pickup_address: d.pickup_address,
            delivery_address: d.delivery_address,
            driver_name: d.driver?.profiles?.full_name || null,
            created_at: d.created_at,
            service_level: d.service_level,
          }))
        );
      }

      // Fetch online drivers with status
      const { data: drivers } = await supabase
        .from('drivers')
        .select(`
          id,
          current_delivery_id,
          is_online,
          vehicle_type,
          profiles(full_name)
        `)
        .eq('is_online', true)
        .eq('status', 'active')
        .limit(8);

      if (drivers) {
        // Get today's completed count for each driver
        const driverIds = drivers.map((d: any) => d.id);
        const { data: todayStats } = await supabase
          .from('deliveries')
          .select('driver_id')
          .in('driver_id', driverIds)
          .gte('delivered_at', today.toISOString())
          .eq('status', 'delivered');

        const completedByDriver: Record<string, number> = {};
        todayStats?.forEach((d: any) => {
          completedByDriver[d.driver_id] = (completedByDriver[d.driver_id] || 0) + 1;
        });

        setDriverStatuses(
          drivers.map((d: any) => ({
            id: d.id,
            full_name: d.profiles?.full_name || 'Unknown Driver',
            current_delivery_id: d.current_delivery_id,
            is_online: d.is_online,
            vehicle_type: d.vehicle_type,
            completed_today: completedByDriver[d.id] || 0,
          }))
        );
      }

      setLoading(false);
    };

    fetchDashboardData();

    // Subscribe to real-time updates
    const deliverySubscription = supabase
      .channel('dashboard-deliveries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => fetchDashboardData()
      )
      .subscribe();

    const driverSubscription = supabase
      .channel('dashboard-drivers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => fetchDashboardData()
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);

    return () => {
      supabase.removeChannel(deliverySubscription);
      supabase.removeChannel(driverSubscription);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Real-time overview of your delivery operations
          </p>
        </div>
        <Link
          href="/map"
          className="inline-flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <MapPin className="h-4 w-4 mr-2" />
          Live Map
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Active Deliveries"
          value={stats.activeDeliveries}
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Online Drivers"
          value={stats.onlineDrivers}
          icon={Truck}
          color="green"
        />
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue / 100)}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Deliveries Today"
          value={stats.todayDeliveries}
          icon={CheckCircle}
          color="purple"
        />
        <StatCard
          title="Avg Delivery Time"
          value={`${stats.avgDeliveryTime} min`}
          icon={Clock}
          color="orange"
        />
        <StatCard
          title="Pending Assignment"
          value={stats.pendingAssignments}
          icon={AlertCircle}
          color={stats.pendingAssignments > 0 ? 'red' : 'gray'}
          alert={stats.pendingAssignments > 0}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent deliveries */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries</h2>
            <Link
              href="/deliveries"
              className="text-sm text-epyc-primary hover:text-blue-700 flex items-center"
            >
              View all
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead className="bg-gray-50">
                <tr>
                  <th>Tracking</th>
                  <th>Status</th>
                  <th>Route</th>
                  <th>Driver</th>
                  <th>Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentDeliveries.map((delivery) => (
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
                        className={`status-badge ${statusColors[delivery.status]}`}
                      >
                        {delivery.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="max-w-[200px]">
                      <div className="text-xs text-gray-500 truncate">
                        {delivery.pickup_address.split(',')[0]}
                      </div>
                      <div className="text-xs text-gray-700 truncate">
                        → {delivery.delivery_address.split(',')[0]}
                      </div>
                    </td>
                    <td>
                      {delivery.driver_name || (
                        <span className="text-yellow-600 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs capitalize">{delivery.service_level}</span>
                    </td>
                  </tr>
                ))}
                {recentDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No deliveries yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Driver status panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Online Drivers</h2>
            <Link
              href="/drivers"
              className="text-sm text-epyc-primary hover:text-blue-700 flex items-center"
            >
              View all
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {driverStatuses.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-epyc-primary rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {driver.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {driver.full_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {driver.vehicle_type.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {driver.current_delivery_id ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      On Delivery
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Available
                    </span>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {driver.completed_today} today
                  </p>
                </div>
              </div>
            ))}
            {driverStatuses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No drivers online</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  alert = false,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  alert?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border p-4 ${alert ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {alert && (
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}
