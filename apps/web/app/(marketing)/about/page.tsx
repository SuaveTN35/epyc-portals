import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Shield,
  Clock,
  MapPin,
  CheckCircle,
  Users,
  Award,
  Truck,
  Phone,
  Heart,
  Target,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about EPYC Courier Service — Southern California\'s most reliable same-day courier. HIPAA compliant, licensed, bonded, and insured.',
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              About EPYC Courier Service
            </h1>
            <p className="text-xl text-white/90">
              Built on reliability, powered by precision. We deliver what matters most — on time, every time.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-epyc-primary font-semibold text-sm uppercase tracking-wide">
                Our Story
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-6">
                From Local Roots to Regional Excellence
              </h2>
              <p className="text-gray-600 mb-4">
                EPYC Courier Service was founded with a simple mission: provide Southern California
                with a courier service that treats every delivery like it matters — because it does.
                Whether it's a life-saving medical specimen or a time-sensitive legal document, we
                understand what's at stake.
              </p>
              <p className="text-gray-600 mb-4">
                Based in Los Angeles, we've grown from a small local operation to one of Southern
                California's most trusted same-day delivery providers. Our team of professional,
                background-checked drivers serves hospitals, law firms, businesses, and individuals
                across the entire region.
              </p>
              <p className="text-gray-600">
                We're not just moving packages — we're building trust, one delivery at a time.
              </p>
            </div>

            <div className="bg-epyc-light rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">By the Numbers</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-epyc-primary">99.8%</p>
                  <p className="text-gray-600 text-sm mt-1">On-Time Delivery Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-epyc-primary">24/7</p>
                  <p className="text-gray-600 text-sm mt-1">Availability</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-epyc-primary">10+</p>
                  <p className="text-gray-600 text-sm mt-1">Counties Served</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-epyc-primary">100%</p>
                  <p className="text-gray-600 text-sm mt-1">HIPAA Compliant</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Values */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Our Mission & Values
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything we do is guided by our commitment to excellence, reliability, and trust.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Target className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Precision</h3>
              <p className="text-gray-600">
                Every delivery is handled with meticulous attention to detail, from pickup to proof of delivery.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Trust</h3>
              <p className="text-gray-600">
                Licensed, bonded, and insured. Background-checked drivers. Your packages are in safe hands.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Clock className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Reliability</h3>
              <p className="text-gray-600">
                99.8% on-time delivery rate. We show up when we say we will and deliver when promised.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Heart className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Care</h3>
              <p className="text-gray-600">
                We treat every package as if it were our own. Temperature-controlled, chain-of-custody, and special handling available.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Users className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Community</h3>
              <p className="text-gray-600">
                We're proud to serve our Southern California community — supporting local businesses, hospitals, and law firms.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Award className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Excellence</h3>
              <p className="text-gray-600">
                We continuously improve our processes, technology, and training to deliver the best service possible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              What Sets Us Apart
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex items-start">
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-epyc-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">HIPAA Certified Drivers</h3>
                <p className="text-gray-600 text-sm">All medical courier drivers are HIPAA trained and certified for compliant handling of protected health information.</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                <MapPin className="h-6 w-6 text-epyc-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Real-Time GPS Tracking</h3>
                <p className="text-gray-600 text-sm">Track every delivery in real-time through our client portal. Know exactly where your package is at all times.</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                <Truck className="h-6 w-6 text-epyc-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Temperature-Controlled Fleet</h3>
                <p className="text-gray-600 text-sm">Specialized vehicles for temperature-sensitive medical specimens and pharmaceuticals.</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                <Shield className="h-6 w-6 text-epyc-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Fully Licensed & Insured</h3>
                <p className="text-gray-600 text-sm">Licensed, bonded, and fully insured. Every package is protected from pickup to delivery.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-epyc-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Experience the EPYC Difference?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Get a quote in minutes or call us 24/7 for immediate service.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/#quote" className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100">
              Get a Quote
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
