import type { Metadata } from 'next';
import { Phone } from 'lucide-react';
import DeliveryRequestForm from '@/components/public/DeliveryRequestForm';

export const metadata: Metadata = {
  title: 'Request a Delivery',
  description:
    'Request a same-day medical, legal, or commercial delivery anywhere in Southern California. No account needed. A dispatcher calls you back with the price.',
};

export default function RequestDeliveryPage() {
  return (
    <>
      <section className="bg-epyc-gradient text-white py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Request a Delivery</h1>
          <p className="text-xl text-white/90">
            Tell us where it is going and when. No account needed. A dispatcher calls you back to
            confirm the price and pickup time.
          </p>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="card p-6 sm:p-8">
            <DeliveryRequestForm />
          </div>
          <p className="text-center text-gray-600 mt-8">
            Need it picked up right now?{' '}
            <a href="tel:8182170070" className="inline-flex items-center text-epyc-primary font-semibold">
              <Phone className="h-4 w-4 mr-1" />
              Call (818) 217-0070
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
