import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Stethoscope,
  Shield,
  Clock,
  CheckCircle,
  Thermometer,
  FileText,
  MapPin,
  Phone,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Medical Courier Service',
  description: 'HIPAA-compliant medical courier service in Southern California. Specimen transport, pharmaceutical delivery, medical records, temperature-controlled vehicles. 24/7 service.',
};

export default function MedicalServicePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <div className="flex items-center mb-4">
              <Stethoscope className="h-8 w-8 mr-3 text-yellow-300" />
              <span className="text-yellow-300 font-semibold text-sm uppercase tracking-wide">
                Medical Courier
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              HIPAA-Compliant Medical Courier Service
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Trusted by hospitals, clinics, and laboratories across Southern California. Temperature-controlled,
              chain-of-custody documented, and available 24/7.
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
              <Shield className="h-5 w-5 mr-2 text-epyc-primary" />
              HIPAA Compliant
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <Thermometer className="h-5 w-5 mr-2 text-epyc-primary" />
              Temperature Controlled
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <FileText className="h-5 w-5 mr-2 text-epyc-primary" />
              Chain of Custody
            </span>
            <span className="flex items-center text-gray-700 font-medium">
              <Clock className="h-5 w-5 mr-2 text-epyc-primary" />
              24/7 Service
            </span>
          </div>
        </div>
      </section>

      {/* What We Transport */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              What We Transport
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From routine lab pickups to emergency specimen transport, we handle it all with the care and compliance your facility demands.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Laboratory Specimens', desc: 'Blood, urine, tissue samples with proper handling and temperature control' },
              { title: 'Pharmaceuticals', desc: 'Prescription medications, controlled substances, and specialty drugs' },
              { title: 'Medical Records', desc: 'Patient files, imaging, X-rays, and confidential health documents' },
              { title: 'Medical Equipment', desc: 'Surgical instruments, diagnostic devices, and durable medical equipment' },
              { title: 'Organs & Tissue', desc: 'Time-critical biological materials with priority handling' },
              { title: 'COVID & Pathogen Samples', desc: 'Biohazard specimens following UN3373 packaging standards' },
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

      {/* Compliance */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-epyc-primary font-semibold text-sm uppercase tracking-wide">
                Compliance & Safety
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-6">
                HIPAA Compliance Built Into Every Delivery
              </h2>
              <p className="text-gray-600 mb-6">
                Our medical courier service meets and exceeds HIPAA requirements. Every driver is trained,
                certified, and background-checked. Every delivery is documented with chain-of-custody records.
              </p>
              <ul className="space-y-3">
                {[
                  'All drivers complete HIPAA privacy and security training',
                  'Background checks and drug screening for all medical couriers',
                  'Chain of custody documentation on every delivery',
                  'Temperature monitoring and logging throughout transport',
                  'Tamper-evident packaging and secure transport containers',
                  'Full insurance coverage for all medical shipments',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-epyc-gradient rounded-2xl p-8 text-white">
              <Lock className="h-12 w-12 mb-4 text-yellow-300" />
              <h3 className="text-2xl font-bold mb-4">Your Compliance Checklist</h3>
              <p className="text-white/80 mb-6">
                Every EPYC medical delivery includes:
              </p>
              <ul className="space-y-3">
                {[
                  'HIPAA-certified driver assignment',
                  'Temperature-controlled transport',
                  'Tamper-evident packaging',
                  'Chain of custody documentation',
                  'Real-time GPS tracking',
                  'Digital proof of delivery',
                  'Incident reporting protocol',
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
              <Clock className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Scheduled Routes</h3>
              <p className="text-gray-600 mb-4">
                Daily, weekly, or custom route schedules for regular lab pickups and deliveries.
              </p>
              <p className="text-epyc-primary font-semibold">Best for routine needs</p>
            </div>

            <div className="card p-8 text-center border-2 border-epyc-primary">
              <AlertTriangle className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">STAT / Rush</h3>
              <p className="text-gray-600 mb-4">
                Priority dispatch for time-critical specimens and emergency medical deliveries.
              </p>
              <p className="text-epyc-primary font-semibold">Pickup within 60 minutes</p>
            </div>

            <div className="card p-8 text-center">
              <MapPin className="h-10 w-10 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">On-Demand</h3>
              <p className="text-gray-600 mb-4">
                Same-day delivery for one-off medical courier needs. No contract required.
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
            Trusted by Healthcare Facilities Across Southern California
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Set up a medical courier account today. No long-term contracts required.
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
