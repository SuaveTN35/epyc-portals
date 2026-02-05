import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  DollarSign,
  TrendingUp,
  Clock,
  Package,
  Zap,
  ChevronRight,
  Star,
} from 'lucide-react';
import { formatCurrency } from '@epyc/shared';
import type { DriverPayout, Delivery } from '@epyc/shared';

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/driver/login');
  }

  // Get driver record
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, rating, total_deliveries, loyalty_tier')
    .eq('profile_id', user.id)
    .single();

  if (!driver) {
    redirect('/driver/onboarding');
  }

  // Get completed deliveries for this week
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const { data: weeklyDeliveries } = await supabase
    .from('deliveries')
    .select('driver_payout, tip_amount, actual_delivery_time')
    .eq('driver_id', driver.id)
    .eq('status', 'delivered')
    .gte('actual_delivery_time', startOfWeek.toISOString());

  const deliveries = (weeklyDeliveries || []) as Partial<Delivery>[];

  // Calculate weekly stats
  const weeklyEarnings = deliveries.reduce(
    (sum, d) => sum + (d.driver_payout || 0) + (d.tip_amount || 0),
    0
  );
  const weeklyTips = deliveries.reduce((sum, d) => sum + (d.tip_amount || 0), 0);
  const weeklyDeliveryCount = deliveries.length;

  // Get recent payouts
  const { data: recentPayouts } = await supabase
    .from('driver_payouts')
    .select('*')
    .eq('driver_id', driver.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const payouts = (recentPayouts || []) as DriverPayout[];

  // Calculate available balance (pending payouts)
  const { data: pendingPayouts } = await supabase
    .from('driver_payouts')
    .select('amount, tip_amount')
    .eq('driver_id', driver.id)
    .eq('status', 'pending');

  const availableBalance = (pendingPayouts || []).reduce(
    (sum, p) => sum + (p.amount || 0) + (p.tip_amount || 0),
    0
  );

  const loyaltyColors = {
    bronze: 'text-orange-600 bg-orange-100',
    silver: 'text-gray-600 bg-gray-100',
    gold: 'text-yellow-600 bg-yellow-100',
    platinum: 'text-purple-600 bg-purple-100',
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Earnings</h1>

      {/* Available Balance Card */}
      <div className="bg-gradient-to-r from-epyc-green via-epyc-teal to-epyc-blue rounded-xl p-6 text-white mb-4">
        <p className="text-green-100 text-sm">Available Balance</p>
        <p className="text-4xl font-bold my-2">{formatCurrency(availableBalance)}</p>
        <button className="mt-2 flex items-center bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors">
          <Zap className="h-5 w-5 mr-2" />
          Instant Payout
          <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">FREE</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <TrendingUp className="h-4 w-4 mr-1" />
            This Week
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(weeklyEarnings)}</p>
          <p className="text-xs text-gray-500">
            {weeklyDeliveryCount} deliveries
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <DollarSign className="h-4 w-4 mr-1" />
            Tips
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(weeklyTips)}</p>
          <p className="text-xs text-gray-500">100% yours</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <Star className="h-4 w-4 mr-1" />
            Rating
          </div>
          <p className="text-2xl font-bold text-gray-900">{driver.rating?.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{driver.total_deliveries} total</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <Package className="h-4 w-4 mr-1" />
            Tier
          </div>
          <span
            className={`inline-block px-2 py-1 rounded-full text-sm font-medium capitalize ${
              loyaltyColors[driver.loyalty_tier as keyof typeof loyaltyColors]
            }`}
          >
            {driver.loyalty_tier}
          </span>
        </div>
      </div>

      {/* Recent Payouts */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Payouts</h2>
        </div>

        {payouts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No payouts yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(payout.amount + (payout.tip_amount || 0))}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(payout.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      payout.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : payout.status === 'processing'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {payout.status}
                  </span>
                  {payout.payout_method === 'instant' && (
                    <p className="text-xs text-gray-400 mt-1">Instant</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-100">
          <button className="w-full flex items-center justify-center text-epyc-primary font-medium">
            View All History
            <ChevronRight className="h-5 w-5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
