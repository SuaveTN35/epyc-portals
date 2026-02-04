'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-xl text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>

          <p className="text-gray-600 mb-6">
            You don't have permission to access the Dispatch Dashboard. This area is restricted
            to authorized dispatchers and administrators only.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-epyc-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-epyc-primary"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>

            <a
              href="https://epyccs.com"
              className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Main Site
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          If you believe this is an error, please contact{' '}
          <a href="mailto:support@epyccs.com" className="text-epyc-primary hover:text-blue-700">
            support@epyccs.com
          </a>
        </p>
      </div>
    </div>
  );
}
