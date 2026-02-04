'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Loader2, Lock, CreditCard, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@epyc/shared';

interface PaymentFormProps {
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
  returnUrl?: string;
}

export function PaymentForm({
  amount,
  onSuccess,
  onError,
  returnUrl,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl || `${window.location.origin}/deliveries`,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Handle error
        const message = error.message || 'An error occurred during payment';
        setErrorMessage(message);
        onError?.(message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        // Payment is processing
        setErrorMessage(
          'Your payment is being processed. You will receive confirmation shortly.'
        );
      } else {
        // Unexpected status
        setErrorMessage('Something went wrong. Please try again.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Display */}
      <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center">
          <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-600">Payment Amount</span>
        </div>
        <span className="text-xl font-bold text-gray-900">
          {formatCurrency(amount)}
        </span>
      </div>

      {/* Stripe Payment Element */}
      <div className="space-y-4">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center px-6 py-3 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Pay {formatCurrency(amount)}
          </>
        )}
      </button>

      {/* Security Notice */}
      <p className="text-xs text-gray-500 text-center flex items-center justify-center">
        <Lock className="h-3 w-3 mr-1" />
        Secured by Stripe. Your payment info is encrypted.
      </p>
    </form>
  );
}
