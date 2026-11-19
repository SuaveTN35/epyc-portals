import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, MessageSquare } from 'lucide-react';
import ContactForm from '@/components/public/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Contact EPYC Courier Service. Call (818) 217-0070 for 24/7 same-day delivery in Southern California. Email admin@epyccs.com.',
};

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Contact Us
            </h1>
            <p className="text-xl text-white/90">
              Have a question or need a delivery? We're here 24/7 to help.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info + Form */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Get in Touch</h2>

              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Phone className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
                    <a href="tel:8182170070" className="text-epyc-primary hover:text-epyc-secondary text-lg font-medium">
                      (818) 217-0070
                    </a>
                    <p className="text-gray-500 text-sm mt-1">Available 24/7 for deliveries and support</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Mail className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                    <a href="mailto:admin@epyccs.com" className="text-epyc-primary hover:text-epyc-secondary text-lg font-medium">
                      admin@epyccs.com
                    </a>
                    <p className="text-gray-500 text-sm mt-1">We respond within 1 business hour</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <MapPin className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Service Area</h3>
                    <p className="text-gray-600">
                      Los Angeles, Orange County, San Diego, Riverside, San Bernardino,
                      Ventura, Santa Barbara, Kern County & All of Southern California
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-12 h-12 bg-epyc-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Clock className="h-6 w-6 text-epyc-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Hours</h3>
                    <p className="text-gray-600">
                      <strong>Dispatch:</strong> 24/7/365<br />
                      <strong>Office:</strong> Mon-Fri 8:00 AM - 6:00 PM PST<br />
                      <strong>Emergency:</strong> Available anytime
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 p-6 bg-epyc-light rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link href="/request-delivery" className="block text-epyc-primary hover:text-epyc-secondary font-medium">
                    Request a Delivery
                  </Link>
                  <Link href="/track" className="block text-epyc-primary hover:text-epyc-secondary font-medium">
                    Track a Package →
                  </Link>
                  <Link href="/client/register" className="block text-epyc-primary hover:text-epyc-secondary font-medium">
                    Create Client Account →
                  </Link>
                  <Link href="/driver/register" className="block text-epyc-primary hover:text-epyc-secondary font-medium">
                    Apply to Drive →
                  </Link>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <div className="card p-8">
                <div className="flex items-center mb-6">
                  <MessageSquare className="h-6 w-6 text-epyc-primary mr-3" />
                  <h2 className="text-2xl font-bold text-gray-900">Send Us a Message</h2>
                </div>

                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-epyc-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Need a Delivery Right Now?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Skip the form — call us directly for immediate service. Dispatchers standing by 24/7.
          </p>
          <a href="tel:8182170070" className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100 inline-flex">
            <Phone className="mr-2 h-5 w-5" />
            (818) 217-0070
          </a>
        </div>
      </section>
    </>
  );
}
