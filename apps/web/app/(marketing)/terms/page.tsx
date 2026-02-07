import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'EPYC Courier Service terms of service. Read our terms and conditions for using our courier delivery services.',
};

export default function TermsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold">Terms of Service</h1>
          <p className="text-white/80 mt-2">Last updated: February 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 prose prose-gray max-w-none">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 mb-6">
            By accessing or using the services provided by UDIG Solutions Inc, doing business as EPYC Courier Service
            (&quot;EPYC,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), including our website (www.epyccs.com), client portal, driver portal,
            and courier delivery services, you agree to be bound by these Terms of Service. If you do not agree,
            please do not use our services.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Services</h2>
          <p className="text-gray-600 mb-6">
            EPYC provides same-day courier and delivery services in Southern California, including but not limited to
            medical courier, legal courier, and commercial delivery services. We reserve the right to refuse service
            to anyone and to modify or discontinue services at any time.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must be at least 18 years old to create an account</li>
            <li>You are responsible for all activity that occurs under your account</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Delivery Terms</h2>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Pickup and Delivery</h3>
          <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-1">
            <li>Delivery times are estimates and not guaranteed unless specifically agreed upon in writing</li>
            <li>We will make reasonable efforts to meet requested delivery windows</li>
            <li>Packages must be properly packaged and labeled before pickup</li>
            <li>Someone must be available at the delivery location to receive the package unless otherwise arranged</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">Prohibited Items</h3>
          <p className="text-gray-600 mb-4">EPYC does not transport:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>Illegal substances or contraband</li>
            <li>Explosives, firearms, or weapons</li>
            <li>Hazardous materials (unless properly classified and documented for medical courier)</li>
            <li>Live animals</li>
            <li>Cash or bearer instruments exceeding $500</li>
            <li>Items requiring special permits we do not hold</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Pricing and Payment</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>Prices are based on distance, urgency, package size, and service type</li>
            <li>Quotes provided are estimates and final charges may vary based on actual conditions</li>
            <li>Payment is due upon delivery unless a business account with net terms has been established</li>
            <li>Business accounts with approved credit may receive net-15 or net-30 terms</li>
            <li>Late payments may incur a 1.5% monthly interest charge</li>
            <li>We accept major credit cards, ACH transfers, and approved business accounts</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Liability and Insurance</h2>
          <p className="text-gray-600 mb-4">
            EPYC maintains commercial general liability insurance and cargo insurance for transported goods.
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>Our standard cargo liability is limited to $100 per package unless additional coverage is requested</li>
            <li>Claims must be filed within 30 days of delivery</li>
            <li>We are not liable for delays caused by weather, traffic, acts of God, or circumstances beyond our control</li>
            <li>We are not liable for improperly packaged items or inaccurate delivery information provided by the client</li>
            <li>Additional cargo insurance is available upon request for high-value items</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Driver Terms</h2>
          <p className="text-gray-600 mb-4">Independent contractor drivers using the EPYC platform agree to:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>Maintain a valid driver&apos;s license and clean driving record</li>
            <li>Maintain adequate vehicle insurance</li>
            <li>Complete required training (including HIPAA training for medical routes)</li>
            <li>Pass background checks and drug screening</li>
            <li>Handle all packages with care and professionalism</li>
            <li>Maintain confidentiality of all delivery contents and client information</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Cancellation Policy</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>Cancellations made before driver dispatch: No charge</li>
            <li>Cancellations made after driver dispatch but before pickup: $15 cancellation fee</li>
            <li>Cancellations made after pickup: Full delivery charge applies</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Intellectual Property</h2>
          <p className="text-gray-600 mb-6">
            All content on our website, including text, graphics, logos, and software, is the property of
            UDIG Solutions Inc and is protected by copyright and trademark laws. You may not reproduce, distribute,
            or create derivative works without our written permission.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Indemnification</h2>
          <p className="text-gray-600 mb-6">
            You agree to indemnify and hold harmless EPYC, its officers, directors, employees, and agents from
            any claims, damages, losses, or expenses arising from your use of our services, violation of these
            terms, or infringement of any third-party rights.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Governing Law</h2>
          <p className="text-gray-600 mb-6">
            These Terms of Service are governed by the laws of the State of California. Any disputes arising
            from these terms shall be resolved in the courts of Los Angeles County, California.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Changes to Terms</h2>
          <p className="text-gray-600 mb-6">
            We reserve the right to modify these Terms of Service at any time. Changes will be posted on this page
            with an updated date. Continued use of our services after changes constitutes acceptance of the updated terms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact Us</h2>
          <p className="text-gray-600 mb-2">
            For questions about these Terms of Service, contact us at:
          </p>
          <div className="bg-epyc-light rounded-lg p-6 mb-6">
            <p className="text-gray-800 font-semibold">EPYC Courier Service (UDIG Solutions Inc)</p>
            <p className="text-gray-600">Email: <a href="mailto:admin@epyccs.com" className="text-epyc-primary hover:text-epyc-secondary">admin@epyccs.com</a></p>
            <p className="text-gray-600">Phone: <a href="tel:8182170070" className="text-epyc-primary hover:text-epyc-secondary">(818) 217-0070</a></p>
            <p className="text-gray-600">Website: www.epyccs.com</p>
          </div>
        </div>
      </section>
    </>
  );
}
