import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Accessibility',
  description:
    'EPYC Courier Service accessibility statement. Our goal for epyccs.com, what we have done, and how to reach us if something does not work for you.',
};

export default function AccessibilityPage() {
  return (
    <>
      <section className="bg-epyc-gradient text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold">Accessibility</h1>
          <p className="text-white/90 mt-2">Last updated: November 2026</p>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our goal</h2>
          <p className="text-gray-700 mb-6">
            We want everyone to be able to request a delivery, track a package, apply to drive and reach us on
            epyccs.com, including people who use a screen reader, a keyboard, voice control, zoom or high contrast
            settings. Our goal is for this site to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at
            Level AA.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">What we have done</h2>
          <ul className="list-disc pl-6 text-gray-700 mb-6 space-y-2">
            <li>Every page and menu works with a keyboard, with a visible focus ring and a link to skip to the main content.</li>
            <li>Form fields have labels, required fields are marked, and errors say what to fix and are read out by screen readers.</li>
            <li>Text and controls meet WCAG color contrast levels.</li>
            <li>Images have text descriptions, and nothing on the site relies on sound or color alone.</li>
            <li>Pages respect your device setting to reduce motion.</li>
            <li>
              Our forms use Cloudflare Turnstile to block spam. For most people it runs on its own with no puzzle, and it
              works with a keyboard and screen readers.
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">If something does not work for you</h2>
          <p className="text-gray-700 mb-4">
            Tell us and we will help you another way, and fix the problem. You can always book a delivery by phone.
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-6 space-y-2">
            <li>
              Call us at{' '}
              <a href="tel:8182170070" className="text-epyc-primary font-semibold underline">
                (818) 217-0070
              </a>
              , 24 hours a day.
            </li>
            <li>
              Email{' '}
              <a href="mailto:admin@epyccs.com" className="text-epyc-primary font-semibold underline">
                admin@epyccs.com
              </a>{' '}
              with the page and what went wrong.
            </li>
            <li>
              Or use our{' '}
              <Link href="/contact" className="text-epyc-primary font-semibold underline">
                contact form
              </Link>
              .
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
