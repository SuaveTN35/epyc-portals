import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Account Deleted',
  robots: { index: false },
};

export default function AccountDeletedPage() {
  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-xl mx-auto px-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Your account is deleted</h1>
        <p role="status" className="text-base text-gray-700 mt-4">
          Your sign-in and personal details are gone. Thanks for using EPYC Courier Service.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center min-h-[44px] mt-8 px-6 py-3 rounded-lg bg-epyc-primary text-white font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-epyc-primary focus-visible:ring-offset-2"
        >
          Go to the home page
        </Link>
      </div>
    </section>
  );
}
