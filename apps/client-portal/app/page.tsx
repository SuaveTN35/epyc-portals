import Link from 'next/link';
import Image from 'next/image';
import { Truck, Clock, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-epyc-green via-epyc-teal to-epyc-blue">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image src="/images/logo.png" alt="EPYC" width={60} height={40} />
            <span className="text-xl font-bold text-white drop-shadow-md">Courier Service</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="http://localhost:3001/register"
              className="text-yellow-300 hover:text-yellow-200 transition-colors font-medium"
            >
              Drive with Us
            </a>
            <Link
              href="/login"
              className="text-white hover:text-gray-200 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-white text-epyc-primary px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Southern California&apos;s Most Reliable
            <span className="block text-epyc-accent">Same-Day Courier</span>
          </h1>
          <p className="text-xl text-gray-300 mb-10">
            Book, track, and manage your deliveries with our easy-to-use client portal.
            Medical-grade precision for every package.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-epyc-accent text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-emerald-600 transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/track"
              className="w-full sm:w-auto bg-white/10 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/20 transition-colors border border-white/30"
            >
              Track a Package
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="bg-epyc-accent/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-epyc-accent" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Real-Time Tracking</h3>
            <p className="text-gray-300">
              Know exactly where your package is with live GPS tracking and ETA updates.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="bg-epyc-accent/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-epyc-accent" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">HIPAA Compliant</h3>
            <p className="text-gray-300">
              Secure medical deliveries with chain of custody tracking and certified drivers.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="bg-epyc-accent/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="h-8 w-8 text-epyc-accent" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Instant Quotes</h3>
            <p className="text-gray-300">
              Get competitive pricing in seconds. No hidden fees, transparent pricing.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-12 mt-20 pt-10 border-t border-white/10">
          <div className="text-center">
            <div className="text-4xl font-bold text-epyc-accent">10,000+</div>
            <div className="text-gray-300">Deliveries Completed</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-epyc-accent">99.7%</div>
            <div className="text-gray-300">On-Time Rate</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-epyc-accent">24/7</div>
            <div className="text-gray-300">Support Available</div>
          </div>
        </div>
      </main>

      {/* Become a Driver CTA */}
      <section className="container mx-auto px-4 py-12">
        <div className="bg-yellow-400 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Want to Drive with EPYC?</h2>
          <p className="text-gray-700 mb-6 max-w-xl mx-auto">
            Join our network of professional drivers. Flexible hours, competitive pay, and instant payouts.
          </p>
          <a
            href="http://localhost:3001/register"
            className="inline-block bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Apply to Drive
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between text-gray-400 text-sm">
          <p>&copy; 2026 UDIG Solutions Inc dba EPYC Courier Service. All rights reserved.</p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <a href="http://localhost:3001/register" className="hover:text-white transition-colors">
              Drive with Us
            </a>
            <span>|</span>
            <a href="https://epyccs.com" className="hover:text-white transition-colors">
              Main Website
            </a>
            <span>|</span>
            <a href="tel:8182170070" className="hover:text-white transition-colors">
              (818) 217-0070
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
