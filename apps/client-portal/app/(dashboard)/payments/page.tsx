import { CreditCard, DollarSign, Download, Plus, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@epyc/shared';
import { PaymentHistoryTable } from '@/components/payments/PaymentHistoryTable';
import { SavedPaymentMethods } from '@/components/payments/SavedPaymentMethods';

async function getPaymentsData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { payments: [], stats: null };

  // Get payments
  const { data: payments } = await supabase
    .from('payments')
    .select(
      `
      *,
      delivery:delivery_id(tracking_number, total_price)
    `
    )
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Calculate stats
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const stats = {
    thisMonth: 0,
    lastMonth: 0,
    totalSpent: 0,
    pendingCharges: 0,
  };

  if (payments) {
    for (const payment of payments) {
      const paymentDate = new Date(payment.created_at);
      const amount = payment.amount || 0;

      if (payment.status === 'succeeded') {
        stats.totalSpent += amount;

        if (paymentDate >= thisMonth) {
          stats.thisMonth += amount;
        } else if (paymentDate >= lastMonth && paymentDate < thisMonth) {
          stats.lastMonth += amount;
        }
      } else if (payment.status === 'pending') {
        stats.pendingCharges += amount;
      }
    }
  }

  return { payments: payments || [], stats };
}

export default async function PaymentsPage() {
  const { payments, stats } = await getPaymentsData();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Manage your payment methods and view history</p>
        </div>
        <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors">
          <Download className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.thisMonth)}
                </p>
              </div>
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-epyc-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Last Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.lastMonth)}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalSpent)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Charges</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.pendingCharges)}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods */}
        <div className="lg:col-span-1">
          <SavedPaymentMethods />
        </div>

        {/* Payment History */}
        <div className="lg:col-span-2">
          <PaymentHistoryTable payments={payments} />
        </div>
      </div>
    </div>
  );
}
