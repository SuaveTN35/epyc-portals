import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle,
  Clock,
  Shield,
  MapPin,
  Truck,
  FileText,
  Stethoscope,
  Building2,
  ArrowRight,
  Phone,
  Star,
  Car,
  DollarSign,
  Calendar,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
              Southern California's Most Reliable Same-Day Courier Service
            </h1>
            <p className="text-xl lg:text-2xl text-white/90 mb-6">
              <strong>Medical | Legal | Commercial</strong> — Delivered with precision, every time.
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-4 mb-8">
              <span className="flex items-center text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                HIPAA Compliant
              </span>
              <span className="flex items-center text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <Shield className="h-4 w-4 mr-2 text-epyc-accent" />
                Licensed & Bonded
              </span>
              <span className="flex items-center text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <MapPin className="h-4 w-4 mr-2 text-epyc-accent" />
                GPS Tracking
              </span>
              <span className="flex items-center text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <FileText className="h-4 w-4 mr-2 text-epyc-accent" />
                Proof of Delivery
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="#quote" className="btn btn-primary btn-lg bg-white text-epyc-primary hover:bg-gray-100">
                Get Instant Quote
              </Link>
              <a href="tel:8182170070" className="btn btn-secondary btn-lg border-white text-white hover:bg-white/10">
                <Phone className="mr-2 h-5 w-5" />
                Call (818) 217-0070
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Professional Courier Services
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Specialized delivery solutions for every industry, with the care and precision your packages deserve.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Medical Courier */}
            <div className="card p-8 card-hover">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Stethoscope className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Medical Courier</h3>
              <p className="text-gray-600 mb-4">
                HIPAA-compliant delivery for specimens, pharmaceuticals, medical records, and equipment. Chain of custody documentation included.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  Temperature-controlled transport
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  HIPAA certified drivers
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  24/7 emergency service
                </li>
              </ul>
              <Link href="/services/medical" className="text-epyc-primary font-semibold flex items-center hover:text-epyc-secondary">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            {/* Legal Courier */}
            <div className="card p-8 card-hover">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <FileText className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Legal Courier</h3>
              <p className="text-gray-600 mb-4">
                Court filings, legal documents, and time-sensitive materials delivered with documented proof of service.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  Same-day court filings
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  Proof of service
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  Confidential handling
                </li>
              </ul>
              <Link href="/services/legal" className="text-epyc-primary font-semibold flex items-center hover:text-epyc-secondary">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            {/* Commercial Delivery */}
            <div className="card p-8 card-hover">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Building2 className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Commercial Delivery</h3>
              <p className="text-gray-600 mb-4">
                Business-to-business delivery for parts, supplies, documents, and packages. Scheduled routes available.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  Scheduled route service
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  Rush delivery available
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2 text-epyc-accent" />
                  Dedicated account manager
                </li>
              </ul>
              <Link href="/services/commercial" className="text-epyc-primary font-semibold flex items-center hover:text-epyc-secondary">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section id="service-areas" className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Serving All of Southern California
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From San Diego to Santa Barbara, we deliver throughout the region with speed and reliability.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              'Los Angeles County',
              'Orange County',
              'San Diego County',
              'Riverside County',
              'San Bernardino County',
              'Ventura County',
              'Santa Barbara',
              'Kern County',
              'Imperial County',
              'Inland Empire',
            ].map((area) => (
              <div key={area} className="bg-epyc-light rounded-lg p-4 text-center">
                <MapPin className="h-6 w-6 text-epyc-primary mx-auto mb-2" />
                <span className="text-gray-700 font-medium">{area}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 lg:py-24 bg-epyc-dark text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Why Choose EPYC?
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              We're not just another courier service. We're your reliable delivery partner.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-epyc-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">24/7 Availability</h3>
              <p className="text-gray-400">
                Emergency deliveries anytime, day or night. We're always here when you need us.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-epyc-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Real-Time Tracking</h3>
              <p className="text-gray-400">
                GPS tracking on every delivery. Know exactly where your package is at all times.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-epyc-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Fully Insured</h3>
              <p className="text-gray-400">
                Licensed, bonded, and insured. Your packages are protected from pickup to delivery.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-epyc-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Proven Track Record</h3>
              <p className="text-gray-400">
                99.8% on-time delivery rate. Trusted by hospitals, law firms, and businesses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Drive with Us Section */}
      <section id="drive" className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-epyc-primary font-semibold text-sm uppercase tracking-wide">
                Join Our Team
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-6">
                Drive with EPYC Courier
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Be your own boss and earn great money on your schedule. Whether you have a car, SUV, or cargo van,
                there's a place for you at EPYC.
              </p>

              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <DollarSign className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Competitive Pay</h3>
                    <p className="text-gray-600 text-sm">Earn $20-40/hr with instant payouts available</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Calendar className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Flexible Schedule</h3>
                    <p className="text-gray-600 text-sm">Work when you want, as much as you want</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Zap className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Instant Payouts</h3>
                    <p className="text-gray-600 text-sm">Get paid same-day, no waiting for payday</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Shield className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Full Support</h3>
                    <p className="text-gray-600 text-sm">24/7 dispatch support and HIPAA training included</p>
                  </div>
                </div>
              </div>

              <Link
                href="/driver/register"
                className="btn btn-primary btn-lg inline-flex items-center"
              >
                <Car className="mr-2 h-5 w-5" />
                Apply to Drive
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>

            <div className="relative">
              <div className="bg-epyc-gradient rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-6">Driver Requirements</h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span>Valid driver's license and clean driving record</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span>Reliable vehicle (2010 or newer preferred)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span>Smartphone with data plan</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span>Pass background check</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-epyc-accent mr-3 flex-shrink-0 mt-0.5" />
                    <span>18 years or older</span>
                  </li>
                </ul>

                <div className="mt-8 pt-6 border-t border-white/20">
                  <p className="text-white/80 text-sm mb-2">Already a driver?</p>
                  <Link href="/driver/login" className="font-semibold text-yellow-300 hover:text-yellow-200">
                    Log in to Driver Portal →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section id="quote" className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Get an Instant Quote
            </h2>
            <p className="text-lg text-gray-600">
              Tell us about your delivery needs and we'll provide a competitive quote.
            </p>
          </div>

          <div className="card p-8">
            <div className="text-center py-8">
              <Truck className="h-16 w-16 text-epyc-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Get Started?</h3>
              <p className="text-gray-600 mb-6">
                Create a client account to book deliveries, get quotes, and track packages online.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/client/register" className="btn btn-primary">
                  Create Client Account
                </Link>
                <a href="tel:8182170070" className="btn btn-secondary">
                  Call for Quote
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-20 bg-epyc-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Need a Delivery Right Now?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Call us 24/7 for immediate service. Our dispatchers are standing by.
          </p>
          <a
            href="tel:8182170070"
            className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100 inline-flex"
          >
            <Phone className="mr-2 h-5 w-5" />
            (818) 217-0070
          </a>
        </div>
      </section>
    </>
  );
}
