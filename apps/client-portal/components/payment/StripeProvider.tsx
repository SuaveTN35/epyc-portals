'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { ReactNode } from 'react';

// Initialize Stripe outside of component to avoid recreating on each render
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
}

export function StripeProvider({ children, clientSecret }: StripeProviderProps) {
  const options = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'stripe' as const,
          variables: {
            colorPrimary: '#047857', // epyc-primary
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#dc2626',
            fontFamily: 'system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
          rules: {
            '.Input': {
              border: '1px solid #d1d5db',
              padding: '12px',
            },
            '.Input:focus': {
              border: '1px solid #047857',
              boxShadow: '0 0 0 1px #047857',
            },
            '.Label': {
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '8px',
            },
          },
        },
      }
    : undefined;

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
