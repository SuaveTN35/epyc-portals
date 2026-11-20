import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Delete Your Account',
  description: 'How to delete your EPYC Courier Service customer or driver account, and what is deleted.',
};

// Public page for the Google Play "delete account" web link and the App Store
// listing. Works without signing in.
export default function DeleteAccountInfoPage() {
  return (
    <>
      <section className="bg-epyc-gradient text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold">Delete your account</h1>
          <p className="text-white/90 mt-2">EPYC Courier Service customer and driver accounts</p>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4 space-y-8 text-base text-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">In the app or on the website</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Sign in.</li>
              <li>
                Customers: open <strong>Settings</strong>. Drivers: open <strong>Profile</strong>.
              </li>
              <li>
                Choose <strong>Delete my account</strong>, type DELETE, and confirm.
              </li>
            </ol>
            <p className="mt-3">
              Your account is deleted right away. If you have a delivery in progress, finish it or call us to cancel it
              first.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">If you cannot sign in</h2>
            <p>
              Email{' '}
              <a href="mailto:admin@epyccs.com?subject=Delete%20my%20account" className="text-epyc-primary underline">
                admin@epyccs.com
              </a>{' '}
              from the address on your account with the subject &quot;Delete my account&quot;. We confirm it is you and
              delete the account within 30 days.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">What is deleted</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your sign-in, name, email, phone number and company name</li>
              <li>For drivers: license, insurance, registration and vehicle photos, vehicle details and location history</li>
              <li>Saved devices for notifications</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">What we keep</h2>
            <p>
              Records of completed deliveries, payments and invoices stay as long as tax, insurance and legal rules
              require, with your name and contact details removed. Medical delivery records are kept as our healthcare
              clients&apos; agreements require.
            </p>
          </div>

          <p>
            See our <Link href="/privacy" className="text-epyc-primary underline">Privacy Policy</Link> for more.
          </p>
        </div>
      </section>
    </>
  );
}
