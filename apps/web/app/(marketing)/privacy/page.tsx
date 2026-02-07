import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'EPYC Courier Service privacy policy. Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold">Privacy Policy</h1>
          <p className="text-white/80 mt-2">Last updated: February 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 prose prose-gray max-w-none">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
          <p className="text-gray-600 mb-6">
            UDIG Solutions Inc, doing business as EPYC Courier Service (&quot;EPYC,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
            is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose,
            and safeguard your information when you visit our website (www.epyccs.com), use our client or driver
            portals, or use our courier services.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Personal Information</h3>
          <p className="text-gray-600 mb-4">We may collect the following personal information:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>Name, email address, phone number, and mailing address</li>
            <li>Business name and billing information</li>
            <li>Delivery pickup and drop-off addresses</li>
            <li>Driver application information (license, vehicle details, background check data)</li>
            <li>Account credentials (email and encrypted password)</li>
            <li>Payment information (processed securely through third-party payment processors)</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">Automatically Collected Information</h3>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>IP address, browser type, and operating system</li>
            <li>Pages visited and time spent on our website</li>
            <li>GPS location data (for active deliveries and driver tracking)</li>
            <li>Device information and unique identifiers</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>To provide and manage courier delivery services</li>
            <li>To process payments and send invoices</li>
            <li>To communicate with you about deliveries, account updates, and support</li>
            <li>To enable real-time delivery tracking</li>
            <li>To verify driver qualifications and maintain safety standards</li>
            <li>To improve our website, services, and customer experience</li>
            <li>To comply with legal obligations and enforce our terms</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. HIPAA Compliance</h2>
          <p className="text-gray-600 mb-6">
            For medical courier services, EPYC complies with the Health Insurance Portability and Accountability Act (HIPAA).
            We maintain appropriate administrative, physical, and technical safeguards to protect Protected Health Information (PHI)
            during transport. Our drivers are HIPAA trained, and we maintain Business Associate Agreements (BAAs) with healthcare
            clients as required.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Information Sharing</h2>
          <p className="text-gray-600 mb-4">We do not sell your personal information. We may share information with:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li><strong>Service providers:</strong> Payment processors, cloud hosting, and analytics tools that help us operate</li>
            <li><strong>Delivery parties:</strong> Sender and recipient information necessary to complete deliveries</li>
            <li><strong>Legal requirements:</strong> When required by law, court order, or to protect our legal rights</li>
            <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Security</h2>
          <p className="text-gray-600 mb-6">
            We implement industry-standard security measures to protect your data, including encryption in transit (TLS/SSL),
            secure data storage, access controls, and regular security assessments. However, no method of electronic transmission
            or storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights</h2>
          <p className="text-gray-600 mb-4">Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-1">
            <li>Access, correct, or delete your personal information</li>
            <li>Opt out of marketing communications</li>
            <li>Request a copy of data we hold about you</li>
            <li>Lodge a complaint with a data protection authority</li>
          </ul>
          <p className="text-gray-600 mb-6">
            California residents have additional rights under the CCPA/CPRA. To exercise any of these rights,
            contact us at <a href="mailto:admin@epyccs.com" className="text-epyc-primary hover:text-epyc-secondary">admin@epyccs.com</a>.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Cookies</h2>
          <p className="text-gray-600 mb-6">
            Our website uses cookies and similar technologies to improve your browsing experience, analyze site traffic,
            and understand where our visitors come from. You can control cookie preferences through your browser settings.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Children&apos;s Privacy</h2>
          <p className="text-gray-600 mb-6">
            Our services are not directed to individuals under 18. We do not knowingly collect personal information
            from children. If you believe we have collected information from a minor, please contact us immediately.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Changes to This Policy</h2>
          <p className="text-gray-600 mb-6">
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated
            &quot;Last updated&quot; date. Continued use of our services after changes constitutes acceptance of the updated policy.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contact Us</h2>
          <p className="text-gray-600 mb-2">
            If you have questions about this Privacy Policy or our data practices, contact us at:
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
