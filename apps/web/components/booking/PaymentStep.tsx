'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Loader2, Shield, CheckCircle } from 'lucide-react';
import { StripeProvider } from '@/components/payment/StripeProvider';
import { PaymentForm } from '@/components/payment/PaymentForm';
import { formatCurrency } from '@epyc/shared';

interface PaymentStepProps {
  deliveryId: string;
  amount: number; // In dollars
  trackingNumber: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function PaymentStep({
  deliveryId,
  amount,
  trackingNumber,
  onSuccess,
  onBack,
}: PaymentStepProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    createPaymentIntent();
  }, [deliveryId, amount]);

  const createPaymentIntent = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          delivery_id: deliveryId,
          metadata: {
            tracking_number: trackingNumber,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentIntentId: string) => {
    setPaymentComplete(true);
    // Short delay to show success state before proceeding
    setTimeout(() => {
      onSuccess();
    }, 1500);
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Payment complete state
  if (paymentComplete) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600">
          Your delivery has been confirmed. Redirecting...
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 text-epyc-primary animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Preparing payment...</p>
      </div>
    );
  }

  // Error state
  if (error && !clientSecret) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-medium">Payment Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={createPaymentIntent}
            className="px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center mb-4">
        <CreditCard className="h-6 w-6 text-epyc-primary mr-2" />
        <h2 className="text-lg font-semibold">Payment</h2>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Order Summary</h3>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium text-gray-900">Delivery Booking</p>
            <p className="text-sm text-gray-500">{trackingNumber}</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(amount)}</p>
        </div>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 py-2 bg-green-50 rounded-lg">
        <Shield className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700">
          256-bit SSL encrypted payment
        </span>
      </div>

      {/* Payment Form */}
      {clientSecret && (
        <StripeProvider clientSecret={clientSecret}>
          <PaymentForm
            amount={amount}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </StripeProvider>
      )}

      {/* Back Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to quote
        </button>
      </div>
    </div>
  );
}
