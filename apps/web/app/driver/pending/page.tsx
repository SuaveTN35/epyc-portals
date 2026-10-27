import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Application Under Review | EPYC Courier',
  robots: { index: false, follow: false },
};

/**
 * Holding page for drivers who finished onboarding but have not been
 * activated by dispatch yet. Middleware sends non-active drivers here
 * instead of the job board.
 */
export default async function DriverPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/driver/login');
  }

  const { data: driver } = await supabase
    .from('drivers')
    .select('status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!driver) {
    redirect('/driver/onboarding');
  }

  if (driver.status === 'active') {
    redirect('/driver/jobs');
  }

  const onHold = driver.status === 'suspended' || driver.status === 'inactive';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-yellow-600" />
        </div>
        {onHold ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Your account is on hold</h1>
            <p className="text-gray-600 mb-6">
              Your driver account is not active right now. Please contact EPYC dispatch if you
              have questions.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Your application is under review</h1>
            <p className="text-gray-600 mb-6">
              Thanks for completing your driver profile. Our team is reviewing your documents and
              we will call you. Once you are approved, the job board opens here automatically.
            </p>
          </>
        )}
        <div className="flex flex-col gap-3">
          <Link
            href="/driver/pending"
            className="w-full py-3 bg-epyc-primary text-white rounded-lg font-medium"
          >
            Check again
          </Link>
          <a href="/api/auth/signout" className="text-sm text-gray-500 underline">
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
