'use client';

import { useState } from 'react';
import { CreditCard, Plus, Trash2, CheckCircle } from 'lucide-react';

interface PaymentMethod {
  id: string;
  type: 'card';
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

// This would normally come from Stripe
const MOCK_PAYMENT_METHODS: PaymentMethod[] = [];

export function SavedPaymentMethods() {
  const [paymentMethods] = useState<PaymentMethod[]>(MOCK_PAYMENT_METHODS);
  const [showAddModal, setShowAddModal] = useState(false);

  const getBrandIcon = (brand: string) => {
    // In a real implementation, you'd use brand-specific icons
    return <CreditCard className="h-8 w-8" />;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center text-sm text-epyc-primary hover:text-emerald-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No saved payment methods</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-epyc-primary text-epyc-primary rounded-lg hover:bg-emerald-50 transition-colors text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`flex items-center justify-between p-4 border rounded-lg ${
                method.is_default
                  ? 'border-epyc-primary bg-emerald-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center">
                <div className="text-gray-400 mr-3">{getBrandIcon(method.brand)}</div>
                <div>
                  <p className="font-medium text-gray-900 flex items-center">
                    <span className="capitalize">{method.brand}</span>
                    <span className="text-gray-500 ml-2">•••• {method.last4}</span>
                    {method.is_default && (
                      <span className="ml-2 inline-flex items-center text-xs text-epyc-primary">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    Expires {method.exp_month.toString().padStart(2, '0')}/
                    {method.exp_year.toString().slice(-2)}
                  </p>
                </div>
              </div>
              <button className="text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Your payment information is securely stored with Stripe
      </p>

      {/* Add Payment Method Modal - would integrate with Stripe Elements */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Payment Method
            </h3>
            <p className="text-gray-600 mb-6">
              Payment method integration requires Stripe setup. Configure your Stripe
              keys in the environment variables to enable this feature.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
