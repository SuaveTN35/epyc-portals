import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';
import { User, Bell, Shield, LogOut } from 'lucide-react';

async function getUserProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

export default async function SettingsPage() {
  const data = await getUserProfile();

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to view settings</p>
      </div>
    );
  }

  const { user, profile } = data;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">Manage your account and preferences</p>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <User className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </div>
          <div className="p-6">
            <ProfileForm
              initialData={{
                id: user.id,
                email: user.email || '',
                full_name: profile?.full_name || '',
                phone: profile?.phone || '',
                company_name: profile?.company_name || '',
                address: profile?.address || '',
                city: profile?.city || '',
                state: profile?.state || '',
                zip: profile?.zip || '',
              }}
            />
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <Bell className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          </div>
          <div className="p-6">
            <NotificationPreferences
              initialPreferences={{
                email_delivery_updates: profile?.email_notifications ?? true,
                sms_delivery_updates: profile?.sms_notifications ?? true,
                email_marketing: profile?.marketing_emails ?? false,
              }}
            />
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <Shield className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <button className="text-sm text-epyc-primary hover:text-epyc-secondary">
                Change
              </button>
            </div>
            <hr />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-500">••••••••••••</p>
              </div>
              <button className="text-sm text-epyc-primary hover:text-epyc-secondary">
                Change
              </button>
            </div>
            <hr />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Not enabled</p>
              </div>
              <button className="text-sm text-epyc-primary hover:text-epyc-secondary">
                Enable
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg shadow border border-red-200">
          <div className="px-6 py-4 border-b border-red-200 flex items-center">
            <LogOut className="h-5 w-5 text-red-500 mr-2" />
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Delete Account</p>
                <p className="text-sm text-gray-500">
                  Permanently delete your account and all data
                </p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
