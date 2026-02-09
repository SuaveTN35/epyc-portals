import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Truck,
  DollarSign,
  Shield,
  Clock,
  MapPin,
  CheckCircle,
  Phone,
  Mail,
  Star,
  Thermometer,
  FileText,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Careers — Drive With EPYC',
  description: 'Join EPYC Courier Service as an independent courier driver in Los Angeles. Medical routes $45-$65/delivery. STAT rush $65-$85. Free HIPAA training. Weekly pay.',
  openGraph: {
    title: 'Drive With EPYC — Independent Courier Drivers Wanted',
    description: 'Medical courier and same-day delivery drivers earning $800-$1,500/week in Los Angeles. Not a gig app — routes assigned directly to you.',
    url: 'https://epyccs.com/careers',
  },
};

const jobPostingSchema = {
  '@context': 'https://schema.org/',
  '@type': 'JobPosting',
  title: 'Independent Courier Driver — Medical & Same-Day Delivery',
  description: `<p>Epyc Courier Service is hiring independent contractor drivers for medical courier and same-day delivery routes throughout the Los Angeles metropolitan area.</p>
<p>We are a locally owned courier company specializing in HIPAA-compliant medical delivery, same-day rush service, and B2B logistics. We are building a small, reliable driver team — not a gig app with 10,000 anonymous drivers.</p>
<h3>What You'll Do:</h3>
<ul>
<li>Pick up and deliver medical specimens, pharmaceuticals, legal documents, and business packages</li>
<li>Run scheduled daily routes for healthcare clients (labs, pharmacies, medical offices)</li>
<li>Handle same-day and rush deliveries across LA County</li>
<li>Maintain chain of custody documentation for medical deliveries</li>
<li>Provide real-time status updates via smartphone</li>
</ul>
<h3>What We Pay:</h3>
<ul>
<li>$25–$35 per delivery (standard same-day)</li>
<li>$45–$65 per delivery (medical/HIPAA routes)</li>
<li>$65–$85 per delivery (STAT/rush under 2 hours)</li>
<li>$150–$200/day for dedicated scheduled routes (5+ stops)</li>
<li>Paid weekly via direct deposit</li>
<li>High-volume drivers consistently earn $800–$1,500/week</li>
</ul>
<h3>Requirements:</h3>
<ul>
<li>Valid California Driver's License (Class C or higher)</li>
<li>Clean driving record — no major violations in the past 3 years</li>
<li>Reliable vehicle (sedan, SUV, or van — must pass inspection)</li>
<li>Current vehicle insurance (100/300/100 minimum)</li>
<li>Smartphone with data plan</li>
<li>Must pass background check</li>
<li>Professional appearance and communication skills</li>
</ul>
<h3>Medical Route Drivers (Higher Pay):</h3>
<ul>
<li>Willing to complete HIPAA training (we provide it — free)</li>
<li>Willing to complete chain of custody training (we provide it — free)</li>
<li>Comfortable handling medical specimens and pharmaceuticals</li>
<li>Available for early morning routes (some medical pickups start at 7:00 AM)</li>
</ul>`,
  identifier: {
    '@type': 'PropertyValue',
    name: 'EPYC Courier Service',
    value: 'EPYC-DRIVER-2026-001',
  },
  datePosted: '2026-02-08',
  validThrough: '2026-06-30',
  employmentType: 'CONTRACTOR',
  hiringOrganization: {
    '@type': 'Organization',
    name: 'Epyc Courier Service',
    sameAs: 'https://www.epyccs.com',
    logo: 'https://www.epyccs.com/images/logo.png',
    url: 'https://www.epyccs.com',
    telephone: '818-217-0070',
    email: 'rico@epyccs.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Los Angeles',
      addressRegion: 'CA',
      addressCountry: 'US',
    },
  },
  jobLocation: {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Los Angeles',
      addressRegion: 'CA',
      postalCode: '90001',
      addressCountry: 'US',
    },
  },
  baseSalary: {
    '@type': 'MonetaryAmount',
    currency: 'USD',
    value: {
      '@type': 'QuantitativeValue',
      minValue: 800,
      maxValue: 1500,
      unitText: 'WEEK',
    },
  },
  jobBenefits: 'Free HIPAA training, weekly pay via direct deposit, flexible scheduling, consistent daily routes, performance bonuses, priority assignments',
  qualifications: 'Valid California Driver\'s License, clean driving record, reliable vehicle, current insurance, smartphone, must pass background check',
  responsibilities: 'Medical specimen transport, pharmaceutical delivery, same-day rush service, chain of custody documentation, real-time status updates',
  skills: 'Driving, navigation, customer service, time management, attention to detail, knowledge of Los Angeles',
  industry: 'Transportation and Logistics',
  occupationalCategory: '53-3031.00',
  directApply: true,
  applicantLocationRequirements: {
    '@type': 'Country',
    name: 'US',
  },
};

export default function CareersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />

      {/* Hero */}
      <section className="bg-epyc-gradient text-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <span className="inline-block bg-white/20 text-white text-sm font-semibold px-4 py-1 rounded-full mb-4">
              NOW HIRING
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Drive With EPYC
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Independent courier drivers earning $800–$1,500/week in Los Angeles.
              Medical routes. Same-day delivery. Scheduled B2B routes.
              Not a gig app — routes assigned directly to you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#apply" className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100 text-center">
                Apply Now
              </a>
              <a href="tel:8182170070" className="btn btn-lg border-white text-white hover:bg-white/10 text-center">
                <Phone className="mr-2 h-5 w-5" />
                Call Rico: (818) 217-0070
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Pay Rates */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              What You Earn
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Transparent pay. No hidden fees. No deductions. Paid weekly via direct deposit.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6 text-center border-2 border-gray-100">
              <DollarSign className="h-8 w-8 text-epyc-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-gray-900">$25–$35</p>
              <p className="text-gray-500 text-sm mt-1">per delivery</p>
              <p className="text-epyc-primary font-semibold mt-2">Standard Same-Day</p>
            </div>
            <div className="card p-6 text-center border-2 border-epyc-primary/30 bg-epyc-light">
              <Thermometer className="h-8 w-8 text-epyc-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-gray-900">$45–$65</p>
              <p className="text-gray-500 text-sm mt-1">per delivery</p>
              <p className="text-epyc-primary font-semibold mt-2">Medical / HIPAA Routes</p>
            </div>
            <div className="card p-6 text-center border-2 border-epyc-primary/30 bg-epyc-light">
              <Clock className="h-8 w-8 text-epyc-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-gray-900">$65–$85</p>
              <p className="text-gray-500 text-sm mt-1">per delivery</p>
              <p className="text-epyc-primary font-semibold mt-2">STAT / Rush (Under 2hrs)</p>
            </div>
            <div className="card p-6 text-center border-2 border-gray-100">
              <Truck className="h-8 w-8 text-epyc-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-gray-900">$150–$200</p>
              <p className="text-gray-500 text-sm mt-1">per day</p>
              <p className="text-epyc-primary font-semibold mt-2">Scheduled Routes (5+ stops)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why EPYC is Different */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              This Is Not a Gig App
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              If you are tired of fighting algorithms for $15 deliveries, this is different.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Users className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Routes Assigned to You</h3>
              <p className="text-gray-600">
                No swiping. No algorithms. No bots. We assign routes directly to you based on your availability and location.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Star className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Consistent Daily Work</h3>
              <p className="text-gray-600">
                Medical routes run every day. Same clients, same schedule, same income. No feast-or-famine.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Phone className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Direct Communication</h3>
              <p className="text-gray-600">
                Call or text Rico directly. No chatbots. No 3-day hold times. No automated support tickets.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Free HIPAA Training</h3>
              <p className="text-gray-600">
                Medical routes pay premium. We provide free HIPAA and chain of custody training — you earn more, we cover the cost.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <DollarSign className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Performance Rewarded</h3>
              <p className="text-gray-600">
                Reliable drivers get priority assignments, rate bonuses, and first pick on new routes. Your work ethic pays.
              </p>
            </div>

            <div className="card p-8">
              <div className="w-14 h-14 bg-epyc-primary/10 rounded-xl flex items-center justify-center mb-6">
                <MapPin className="h-7 w-7 text-epyc-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">LA Coverage</h3>
              <p className="text-gray-600">
                DTLA, Mid-Wilshire, Hollywood, SFV, Westside, South Bay, Glendale, Pasadena, Long Beach — all LA County.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">
                Requirements
              </h2>
              <div className="space-y-4">
                {[
                  'Valid California Driver\'s License (Class C or higher)',
                  'Clean driving record — no major violations in past 3 years',
                  'Reliable vehicle (sedan, SUV, or van — must pass inspection)',
                  'Current vehicle insurance (100/300/100 minimum)',
                  'Current vehicle registration',
                  'Smartphone with data plan (iPhone or Android)',
                  'Must pass background check',
                  'Professional appearance and communication skills',
                ].map((req) => (
                  <div key={req} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-epyc-primary mt-0.5 mr-3 flex-shrink-0" />
                    <p className="text-gray-700">{req}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">
                Medical Route Drivers
              </h2>
              <div className="bg-epyc-light rounded-2xl p-8">
                <p className="text-epyc-primary font-bold text-lg mb-4">HIGHER PAY — Premium Routes</p>
                <div className="space-y-4">
                  {[
                    'Willing to complete HIPAA training (we provide it — free)',
                    'Willing to complete chain of custody training (we provide it — free)',
                    'Comfortable handling medical specimens and pharmaceuticals',
                    'Available for early morning routes (pickups start at 7:00 AM)',
                  ].map((req) => (
                    <div key={req} className="flex items-start">
                      <Star className="h-5 w-5 text-epyc-primary mt-0.5 mr-3 flex-shrink-0" />
                      <p className="text-gray-700">{req}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Hours</h3>
                <div className="space-y-2 text-gray-600">
                  <p><strong>Standard:</strong> 7:00 AM – 7:00 PM, Monday–Friday</p>
                  <p><strong>Saturday:</strong> Available (a plus, not required)</p>
                  <p><strong>Flexibility:</strong> You set your availability, we assign accordingly</p>
                  <p><strong>Options:</strong> Full-time and part-time both welcome</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Apply */}
      <section id="apply" className="py-16 lg:py-20 bg-epyc-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Drive With EPYC?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Send us your info and we will get back to you within 24 hours.
          </p>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-left max-w-xl mx-auto">
            <p className="text-white/90 mb-6">
              Reply with:
            </p>
            <ol className="space-y-3 text-white/90 list-decimal list-inside mb-8">
              <li>Your name and phone number</li>
              <li>Your vehicle type (year, make, model)</li>
              <li>Your zip code</li>
              <li>Days and hours you are available</li>
              <li>Any courier or delivery experience</li>
            </ol>

            <div className="space-y-4">
              <a
                href="mailto:rico@epyccs.com?subject=Driver%20Application%20-%20Epyc%20Courier&body=Name%3A%20%0APhone%3A%20%0AVehicle%20(Year%2C%20Make%2C%20Model)%3A%20%0AZip%20Code%3A%20%0AAvailability%20(Days%2FHours)%3A%20%0ACourier%20Experience%3A%20"
                className="btn btn-lg bg-white text-epyc-primary hover:bg-gray-100 w-full text-center flex items-center justify-center"
              >
                <Mail className="mr-2 h-5 w-5" />
                Email Your Application
              </a>
              <a
                href="tel:8182170070"
                className="btn btn-lg border-white text-white hover:bg-white/10 w-full text-center flex items-center justify-center"
              >
                <Phone className="mr-2 h-5 w-5" />
                Call Rico: (818) 217-0070
              </a>
            </div>
          </div>

          <p className="text-white/70 text-sm mt-8">
            Epyc Courier Service | UDIG Solutions Inc | Los Angeles, CA
          </p>
        </div>
      </section>
    </>
  );
}
