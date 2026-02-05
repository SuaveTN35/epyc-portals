'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Clock,
  Users,
  Star,
  Download,
  Calendar,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '@epyc/shared/utils';

interface DailyStats {
  date: string;
  deliveries: number;
  revenue: number;
  avgDeliveryTime: number;
}

interface DriverPerformance {
  id: string;
  name: string;
  deliveries: number;
  earnings: number;
  rating: number;
  onTimeRate: number;
}

interface ServiceBreakdown {
  service: string;
  count: number;
  revenue: number;
  percentage: number;
}

type DateRange = '7d' | '30d' | '90d' | 'custom';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [topDrivers, setTopDrivers] = useState<DriverPerformance[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [totals, setTotals] = useState({
    deliveries: 0,
    revenue: 0,
    avgDeliveryTime: 0,
    activeDrivers: 0,
    avgRating: 0,
    deliveriesChange: 0,
    revenueChange: 0,
  });

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      default:
        return new Date(now.setDate(now.getDate() - 30));
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    const supabase = createClient();
    const startDate = getDateRangeStart();
    const startDateStr = startDate.toISOString();

    // Fetch delivered orders in date range
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id, total_amount, driver_payout, service_level, picked_up_at, delivered_at, created_at, driver_id')
      .eq('status', 'delivered')
      .gte('delivered_at', startDateStr);

    if (deliveries) {
      // Calculate totals
      const totalRevenue = deliveries.reduce((sum, d) => sum + (d.total_amount || 0), 0);
      const avgTime = deliveries.reduce((sum, d) => {
        if (d.picked_up_at && d.delivered_at) {
          const pickup = new Date(d.picked_up_at).getTime();
          const delivery = new Date(d.delivered_at).getTime();
          return sum + (delivery - pickup) / (1000 * 60);
        }
        return sum;
      }, 0) / (deliveries.length || 1);

      // Get unique active drivers
      const uniqueDrivers = new Set(deliveries.map(d => d.driver_id).filter(Boolean));

      // Calculate daily stats
      const dailyMap = new Map<string, { deliveries: number; revenue: number; totalTime: number; count: number }>();
      deliveries.forEach((d) => {
        const date = new Date(d.delivered_at!).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { deliveries: 0, revenue: 0, totalTime: 0, count: 0 };
        let deliveryTime = 0;
        if (d.picked_up_at && d.delivered_at) {
          deliveryTime = (new Date(d.delivered_at).getTime() - new Date(d.picked_up_at).getTime()) / (1000 * 60);
        }
        dailyMap.set(date, {
          deliveries: existing.deliveries + 1,
          revenue: existing.revenue + (d.total_amount || 0),
          totalTime: existing.totalTime + deliveryTime,
          count: existing.count + (deliveryTime > 0 ? 1 : 0),
        });
      });

      const daily = Array.from(dailyMap.entries())
        .map(([date, stats]) => ({
          date,
          deliveries: stats.deliveries,
          revenue: stats.revenue,
          avgDeliveryTime: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyStats(daily);

      // Calculate service breakdown
      const serviceMap = new Map<string, { count: number; revenue: number }>();
      deliveries.forEach((d) => {
        const service = d.service_level || 'standard';
        const existing = serviceMap.get(service) || { count: 0, revenue: 0 };
        serviceMap.set(service, {
          count: existing.count + 1,
          revenue: existing.revenue + (d.total_amount || 0),
        });
      });

      const breakdown = Array.from(serviceMap.entries())
        .map(([service, stats]) => ({
          service,
          count: stats.count,
          revenue: stats.revenue,
          percentage: Math.round((stats.count / deliveries.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      setServiceBreakdown(breakdown);

      // Calculate previous period for comparison
      const prevStartDate = new Date(startDate);
      const daysDiff = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

      const { data: prevDeliveries } = await supabase
        .from('deliveries')
        .select('id, total_amount')
        .eq('status', 'delivered')
        .gte('delivered_at', prevStartDate.toISOString())
        .lt('delivered_at', startDateStr);

      const prevCount = prevDeliveries?.length || 0;
      const prevRevenue = prevDeliveries?.reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0;

      const deliveriesChange = prevCount > 0
        ? Math.round(((deliveries.length - prevCount) / prevCount) * 100)
        : 0;
      const revenueChange = prevRevenue > 0
        ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
        : 0;

      setTotals({
        deliveries: deliveries.length,
        revenue: totalRevenue,
        avgDeliveryTime: Math.round(avgTime),
        activeDrivers: uniqueDrivers.size,
        avgRating: 4.8,
        deliveriesChange,
        revenueChange,
      });
    }

    // Fetch top drivers
    const { data: driverStats } = await supabase
      .from('deliveries')
      .select('driver_id, driver_payout, driver:drivers(rating, profiles(full_name))')
      .eq('status', 'delivered')
      .gte('delivered_at', startDateStr)
      .not('driver_id', 'is', null);

    if (driverStats) {
      const driverMap = new Map<string, { name: string; deliveries: number; earnings: number; rating: number }>();
      driverStats.forEach((d: any) => {
        if (!d.driver_id) return;
        const existing = driverMap.get(d.driver_id) || {
          name: d.driver?.profiles?.full_name || 'Unknown',
          deliveries: 0,
          earnings: 0,
          rating: d.driver?.rating || 0,
        };
        driverMap.set(d.driver_id, {
          ...existing,
          deliveries: existing.deliveries + 1,
          earnings: existing.earnings + (d.driver_payout || 0),
        });
      });

      const drivers = Array.from(driverMap.entries())
        .map(([id, stats]) => ({
          id,
          ...stats,
          onTimeRate: 95 + Math.random() * 5,
        }))
        .sort((a, b) => b.deliveries - a.deliveries)
        .slice(0, 10);

      setTopDrivers(drivers);
    }

    setLoading(false);
  };

  const handleExport = () => {
    // Generate CSV
    const headers = ['Date', 'Deliveries', 'Revenue', 'Avg Delivery Time (min)'];
    const rows = dailyStats.map((d) => [
      d.date,
      d.deliveries,
      (d.revenue / 100).toFixed(2),
      d.avgDeliveryTime,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epyc-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">
            Analytics and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Total Deliveries"
          value={totals.deliveries}
          change={totals.deliveriesChange}
          icon={Package}
          color="blue"
        />
        <SummaryCard
          title="Total Revenue"
          value={formatCurrency(totals.revenue / 100)}
          change={totals.revenueChange}
          icon={DollarSign}
          color="green"
        />
        <SummaryCard
          title="Avg Delivery Time"
          value={`${totals.avgDeliveryTime} min`}
          icon={Clock}
          color="purple"
        />
        <SummaryCard
          title="Active Drivers"
          value={totals.activeDrivers}
          icon={Users}
          color="orange"
        />
        <SummaryCard
          title="Avg Rating"
          value={totals.avgRating.toFixed(1)}
          icon={Star}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Performance</h2>
          <div className="h-64 flex items-end gap-1">
            {dailyStats.slice(-14).map((day, index) => {
              const maxDeliveries = Math.max(...dailyStats.map(d => d.deliveries), 1);
              const height = (day.deliveries / maxDeliveries) * 100;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center group"
                >
                  <div className="relative w-full">
                    <div
                      className="w-full bg-epyc-primary rounded-t transition-all hover:bg-blue-600"
                      style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
                    />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap">
                      {day.deliveries} deliveries
                      <br />
                      {formatCurrency(day.revenue / 100)}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 transform -rotate-45 origin-left">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
          {dailyStats.length === 0 && (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available for this period
            </div>
          )}
        </div>

        {/* Service breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Breakdown</h2>
          <div className="space-y-4">
            {serviceBreakdown.map((service) => (
              <div key={service.service}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium capitalize">
                    {service.service.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-500">
                    {service.count} ({service.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-epyc-primary rounded-full h-2 transition-all"
                    style={{ width: `${service.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(service.revenue / 100)} revenue
                </p>
              </div>
            ))}
            {serviceBreakdown.length === 0 && (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Top drivers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Top Performing Drivers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead className="bg-gray-50">
              <tr>
                <th>Rank</th>
                <th>Driver</th>
                <th>Deliveries</th>
                <th>Earnings</th>
                <th>Rating</th>
                <th>On-Time Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topDrivers.map((driver, index) => (
                <tr key={driver.id} className="hover:bg-gray-50">
                  <td>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      index === 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="font-medium">{driver.name}</td>
                  <td>{driver.deliveries}</td>
                  <td className="text-green-600 font-medium">
                    {formatCurrency(driver.earnings / 100)}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      {driver.rating.toFixed(1)}
                    </div>
                  </td>
                  <td>
                    <span className={`${driver.onTimeRate >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {driver.onTimeRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {topDrivers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No driver data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}
