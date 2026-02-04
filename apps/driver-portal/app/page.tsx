import Link from 'next/link';
import Image from 'next/image';
import { DollarSign, Clock, Shield, Star, Zap } from 'lucide-react';

export default function DriverLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-epyc-green via-epyc-teal to-epyc-blue">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image src="/images/logo.png" alt="EPYC" width={60} height={40} />
            <span className="text-2xl font-bold text-white drop-shadow-md">Driver</span>
          </div>
          <div className="flex items-center space-x-4">
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
              Start Driving
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Drive Your Way.
            <span className="block text-yellow-300">Earn Your Way.</span>
          </h1>
          <p className="text-xl text-emerald-100 mb-10">
            Join Southern California&apos;s fastest-growing courier network.
            Fair pay, instant payouts, and respect for veteran drivers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-yellow-400 text-gray-900 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-yellow-300 transition-colors"
            >
              Apply to Drive
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto bg-white/10 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/20 transition-colors border border-white/30"
            >
              Existing Driver? Sign In
            </Link>
          </div>
        </div>

        {/* Earnings Highlight */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mt-16 max-w-2xl mx-auto">
          <div className="text-center">
            <p className="text-emerald-200 mb-2">Average earnings</p>
            <p className="text-5xl font-bold text-white mb-2">$25 - $45<span className="text-2xl">/hr</span></p>
            <p className="text-emerald-200">Based on vehicle type and delivery volume</p>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="bg-yellow-400/20 w-14 h-14 rounded-full flex items-center justify-center mb-4">
              <Zap className="h-7 w-7 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Instant Pay</h3>
            <p className="text-emerald-200">
              Get paid within minutes of completing a delivery. No waiting, no fees.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="bg-yellow-400/20 w-14 h-14 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-7 w-7 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Flexible Schedule</h3>
            <p className="text-emerald-200">
              Work when you want. No minimums, no commitments. You&apos;re in control.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="bg-yellow-400/20 w-14 h-14 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-7 w-7 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Full Transparency</h3>
            <p className="text-emerald-200">
              See job details before accepting. Weight, dimensions, payout - no surprises.
            </p>
          </div>
        </div>

        {/* Why EPYC */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Why Drivers Choose EPYC</h2>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex items-start space-x-4 bg-white/5 rounded-lg p-4">
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <DollarSign className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">100% of Tips</h4>
                <p className="text-emerald-200 text-sm">You keep every dollar customers tip you.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/5 rounded-lg p-4">
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <Star className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Loyalty Rewards</h4>
                <p className="text-emerald-200 text-sm">Priority access to high-value jobs as you level up.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/5 rounded-lg p-4">
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Cargo Insurance</h4>
                <p className="text-emerald-200 text-sm">All deliveries covered. No driver liability.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/5 rounded-lg p-4">
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <Clock className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">24/7 Support</h4>
                <p className="text-emerald-200 text-sm">Real humans ready to help, not bots.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Types */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Drive Any Vehicle</h2>
          <p className="text-emerald-200 mb-8">Earn more with larger vehicles</p>

          <div className="flex flex-wrap justify-center gap-4">
            {[
              { icon: '🚗', label: 'Car', rate: '$15-25/hr' },
              { icon: '🚙', label: 'SUV', rate: '$20-30/hr' },
              { icon: '🚐', label: 'Van', rate: '$25-40/hr' },
              { icon: '🛻', label: 'Truck', rate: '$30-50/hr' },
              { icon: '🚚', label: 'Box Truck', rate: '$40-65/hr' },
            ].map((vehicle) => (
              <div key={vehicle.label} className="bg-white/10 rounded-xl p-4 w-28">
                <span className="text-3xl">{vehicle.icon}</span>
                <p className="text-white font-medium mt-2">{vehicle.label}</p>
                <p className="text-emerald-300 text-sm">{vehicle.rate}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <div className="bg-yellow-400 rounded-2xl p-8 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start Earning?</h2>
            <p className="text-gray-700 mb-6">
              Sign up takes less than 5 minutes. Start delivering as soon as your background check clears.
            </p>
            <Link
              href="/register"
              className="inline-block bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-10 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between text-emerald-200 text-sm">
          <p>&copy; 2026 UDIG Solutions Inc dba EPYC Courier Service</p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
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
