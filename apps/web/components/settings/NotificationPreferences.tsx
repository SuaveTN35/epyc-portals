'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface NotificationPreferencesProps {
  initialPreferences: {
    email_delivery_updates: boolean;
    sms_delivery_updates: boolean;
    email_marketing: boolean;
  };
}

export function NotificationPreferences({
  initialPreferences,
}: NotificationPreferencesProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [preferences, setPreferences] = useState(initialPreferences);

  const handleToggle = async (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    await supabase.from('profiles').update({
      email_notifications: preferences.email_delivery_updates,
      sms_notifications: preferences.sms_delivery_updates,
      marketing_emails: preferences.email_marketing,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    setSuccess(true);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Delivery Updates
        </h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-gray-900">Email notifications</p>
              <p className="text-sm text-gray-500">
                Receive email updates when your delivery status changes
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('email_delivery_updates')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-epyc-primary focus:ring-offset-2 ${
                preferences.email_delivery_updates
                  ? 'bg-epyc-primary'
                  : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.email_delivery_updates
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="text-gray-900">SMS notifications</p>
              <p className="text-sm text-gray-500">
                Receive text messages for real-time delivery updates
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('sms_delivery_updates')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-epyc-primary focus:ring-offset-2 ${
                preferences.sms_delivery_updates
                  ? 'bg-epyc-primary'
                  : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.sms_delivery_updates
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      <hr />

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Marketing Communications
        </h3>
        <label className="flex items-center justify-between">
          <div>
            <p className="text-gray-900">Marketing emails</p>
            <p className="text-sm text-gray-500">
              Receive promotional offers and company news
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle('email_marketing')}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-epyc-primary focus:ring-offset-2 ${
              preferences.email_marketing ? 'bg-epyc-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                preferences.email_marketing ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      <div className="flex items-center justify-end gap-4 pt-4">
        {success && (
          <span className="flex items-center text-sm text-green-600">
            <Check className="h-4 w-4 mr-1" />
            Saved successfully
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </div>
  );
}
