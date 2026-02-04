'use client';

import { CreditCard, CheckCircle, Clock, XCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@epyc/shared';

interface Payment {
  id: string;
  delivery_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  payment_method?: string | null;
  stripe_payment_intent_id?: string | null;
  created_at: string;
  delivery?: {
    tracking_number: string;
    total_price: number;
  } | null;
}

interface PaymentHistoryTableProps {
  payments: Payment[];
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
  },
  succeeded: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
  refunded: {
    label: 'Refunded',
    icon: CreditCard,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
};

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No payment history yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delivery
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => {
              const statusConfig = STATUS_CONFIG[payment.status];
              const StatusIcon = statusConfig.icon;

              return (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(payment.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.delivery ? (
                      <Link
                        href={`/deliveries/${payment.delivery_id}`}
                        className="text-sm font-medium text-epyc-primary hover:underline flex items-center"
                      >
                        {payment.delivery.tracking_number}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {payment.payment_method || 'Card'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(payment.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
