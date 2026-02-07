import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText,
  Shield,
  Clock,
  CheckCircle,
  Scale,
  Stamp,
  Phone,
  MapPin,
  Lock,
  AlertTriangle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Legal Courier Service',
  description: 'Professional legal courier service in Southern California. Same-day court filings, process service, proof of service documentation. Trusted by law firms.',
};

export default function LegalServicePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <div className="flex items-center mb-4">
              <Scale className="h-8 w-8 mr-3 text-yellow-300" />
              <span className="text-yellow-300 font-semibold text-sm uppercase tracking-wide">
                Legal Courier
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Professional Legal Courier Service
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Court filings, legal documents, and time-sensitive materials delivered with documented
              proof of service. Trusted by law firms across Southern California.
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
              <Stamp className="h-5 w-5 mr-2 text-epyc-primary" />
              Proof of Service
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <Lock className="h-5 w-5 mr-2 text-epyc-primary" />
              Confidential Handling
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <Clock className="h-5 w-5 mr-2 text-epyc-primary" />
              Same-Day Filing
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <MapPin className="h-5 w-5 mr-2 text-epyc-primary" />
              All SoCal Courts
            </span>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Legal Courier Services
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From routine document delivery to urgent court filings, we handle your legal materials with the confidentiality and urgency they demand.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Court Filings', desc: 'Same-day filing at any courthouse in Southern California. Conformed copies returned.' },
              { title: 'Process Service', desc: 'Professional service of process with documented proof of service and multiple attempts.' },
              { title: 'Deposition Delivery', desc: 'Secure transport of deposition transcripts, exhibits, and related legal materials.' },
              { title: 'Document Retrieval', desc: 'Court records, certified copies, and public records retrieved on your behalf.' },
              { title: 'Inter-Office Delivery', desc: 'Confidential document delivery between offices, opposing counsel, and clients.' },
              { title: 'Real Estate Closings', desc: 'Time-sensitive closing documents, title packages, and recording submissions.' },
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

      {/* Why Law Firms Choose Us */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-epyc-primary font-semibold text-sm uppercase tracking-wide">
                Why Law Firms Choose EPYC
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-6">
                Deadlines Don't Wait. Neither Do We.
              </h2>
              <p className="text-gray-600 mb-6">
                In the legal world, missing a filing deadline can mean losing a case. Our legal courier
                team understands the urgency and importance of every document we handle.
              </p>
              <ul className="space-y-3">
                {[
                  'Experienced couriers familiar with all SoCal courthouses',
                  'Real-time tracking and delivery confirmation',
                  'Digital proof of service documentation',
                  'Secure, confidential handling of all materials',
                  'Priority rush service for emergency filings',
                  'Dedicated account manager for law firm clients',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-epyc-gradient rounded-2xl p-8 text-white">
              <FileText className="h-12 w-12 mb-4 text-yellow-300" />
              <h3 className="text-2xl font-bold mb-4">Courts We Serve</h3>
              <p className="text-white/80 mb-6">
                Our couriers are familiar with filing procedures at:
              </p>
              <ul className="space-y-3">
                {[
                  'Los Angeles Superior Court (all districts)',
                  'Orange County Superior Court',
                  'San Diego Superior Court',
                  'Riverside Superior Court',
                  'San Bernardino Superior Court',
                  'U.S. District Court — Central District',
                  'California Court of Appeal',
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

      {/* Service Tiers */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Service Options
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-8 text-center">
              <Clock className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Scheduled Service</h3>
              <p className="text-gray-600 mb-4">
                Regular pickup and delivery routes for daily or weekly legal document needs.
              </p>
              <p className="text-epyc-primary font-semibold">Volume discounts available</p>
            </div>

            <div className="card p-8 text-center border-2 border-epyc-primary">
              <AlertTriangle className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Rush / Same-Day</h3>
              <p className="text-gray-600 mb-4">
                Priority dispatch for deadline-critical filings and urgent document delivery.
              </p>
              <p className="text-epyc-primary font-semibold">Pickup within 60 minutes</p>
            </div>

            <div className="card p-8 text-center">
              <Shield className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">On-Demand</h3>
              <p className="text-gray-600 mb-4">
                One-off deliveries for occasional legal courier needs. No contract required.
              </p>
              <p className="text-epyc-primary font-semibold">Call anytime, 24/7</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-epyc-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Trusted by Law Firms Across Southern California
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Set up a legal courier account today. No long-term contracts required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/client/register" className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100">
              Create Account
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
