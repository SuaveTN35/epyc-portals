import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Building2,
  Shield,
  Clock,
  CheckCircle,
  Package,
  Truck,
  Phone,
  MapPin,
  Calendar,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Commercial Delivery Service',
  description: 'Same-day commercial delivery service in Southern California. B2B logistics, scheduled routes, rush delivery. Parts, supplies, documents, and packages.',
};

export default function CommercialServicePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <div className="flex items-center mb-4">
              <Building2 className="h-8 w-8 mr-3 text-yellow-300" />
              <span className="text-yellow-300 font-semibold text-sm uppercase tracking-wide">
                Commercial Delivery
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Reliable Commercial Delivery Service
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Business-to-business delivery for parts, supplies, documents, and packages.
              Scheduled routes, rush delivery, and dedicated account management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/#quote" className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100">
                Get a Quote
              </Link>
              <a href="tel:8182170070" className="btn btn-lg border-white text-white hover:bg-white/10">
                <Phone className="mr-2 h-5 w-5" />
                (818) 217-0070
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-8 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8">
            <span className="flex items-center text-gray-700 font-medium">
              <Truck className="h-5 w-5 mr-2 text-epyc-primary" />
              Same-Day Delivery
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <Calendar className="h-5 w-5 mr-2 text-epyc-primary" />
              Scheduled Routes
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <MapPin className="h-5 w-5 mr-2 text-epyc-primary" />
              GPS Tracking
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <Shield className="h-5 w-5 mr-2 text-epyc-primary" />
              Fully Insured
            </span>
          </div>
        </div>
      </section>

      {/* Industries We Serve */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Industries We Serve
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Whatever your business needs delivered, we have the experience and fleet to handle it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Auto Parts & Dealerships', desc: 'Same-day parts delivery between dealerships, body shops, and suppliers.' },
              { title: 'Manufacturing & Warehousing', desc: 'Time-critical parts, raw materials, and finished goods between facilities.' },
              { title: 'Retail & E-Commerce', desc: 'Last-mile delivery, returns processing, and inventory transfers.' },
              { title: 'Architecture & Engineering', desc: 'Plans, blueprints, permits, and building materials delivered same-day.' },
              { title: 'Financial Services', desc: 'Secure transport of checks, documents, and confidential financial materials.' },
              { title: 'General Business', desc: 'Office supplies, equipment, documents, and packages between locations.' },
            ].map((item) => (
              <div key={item.title} className="card p-6">
                <CheckCircle className="h-6 w-6 text-epyc-accent mb-3" />
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Businesses Choose Us */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-epyc-primary font-semibold text-sm uppercase tracking-wide">
                Your Delivery Partner
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-6">
                Built for Business
              </h2>
              <p className="text-gray-600 mb-6">
                We understand that business deliveries aren't just packages — they're promises to your
                customers, partners, and supply chain. That's why we treat every delivery with urgency
                and professionalism.
              </p>
              <ul className="space-y-3">
                {[
                  'Dedicated account manager for your business',
                  'Custom scheduling for regular routes',
                  'Volume pricing for high-frequency shippers',
                  'Real-time tracking and delivery notifications',
                  'Digital proof of delivery with signature capture',
                  'Flexible fleet: cars, SUVs, cargo vans, and box trucks',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-epyc-gradient rounded-2xl p-8 text-white">
              <Package className="h-12 w-12 mb-4 text-yellow-300" />
              <h3 className="text-2xl font-bold mb-4">What We Can Deliver</h3>
              <p className="text-white/80 mb-6">
                Our commercial fleet handles:
              </p>
              <ul className="space-y-3">
                {[
                  'Envelopes and small packages',
                  'Auto parts and equipment',
                  'Palletized freight (up to LTL)',
                  'Construction materials and supplies',
                  'Office equipment and furniture',
                  'Sensitive electronics and IT equipment',
                  'Samples and prototypes',
                ].map((item) => (
                  <li key={item} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-yellow-300 mr-3 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Service Options */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Service Options
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-8 text-center">
              <Calendar className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Scheduled Routes</h3>
              <p className="text-gray-600 mb-4">
                Daily or weekly scheduled pickups and deliveries at your locations. Consistent, reliable service.
              </p>
              <p className="text-epyc-primary font-semibold">Best value for regular needs</p>
            </div>

            <div className="card p-8 text-center border-2 border-epyc-primary">
              <Zap className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Rush / Same-Day</h3>
              <p className="text-gray-600 mb-4">
                Priority dispatch for urgent business deliveries. Get it there today, guaranteed.
              </p>
              <p className="text-epyc-primary font-semibold">Pickup within 60 minutes</p>
            </div>

            <div className="card p-8 text-center">
              <Truck className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">On-Demand</h3>
              <p className="text-gray-600 mb-4">
                One-off deliveries when you need them. No contract, no commitment. Just call.
              </p>
              <p className="text-epyc-primary font-semibold">No minimums required</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-epyc-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Streamline Your Deliveries?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Set up a business account and start delivering today. Volume discounts available.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/client/register" className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100">
              Create Business Account
            </Link>
            <a href="tel:8182170070" className="btn btn-lg border-white text-white hover:bg-white/10">
              <Phone className="mr-2 h-5 w-5" />
              (818) 217-0070
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
