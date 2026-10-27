'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SMS_CONSENT_TEXT } from '@/lib/sms';

/** Lets a driver turn job texts on or off after onboarding. */
export function SmsOptInToggle({ initial, hasPhone }: { initial: boolean; hasPhone: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !on;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError('Sign in again.');
      return;
    }
    const { error: updateError } = await supabase.from('profiles').update({ sms_opt_in: next }).eq('id', user.id);
    setSaving(false);
    if (updateError) {
      setError('Could not save. Try again.');
      return;
    }
    setOn(next);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          disabled={saving}
          onChange={toggle}
          className="mt-0.5 h-5 w-5 rounded border-gray-300 text-epyc-primary flex-shrink-0"
        />
        <span>
          <span className="flex items-center font-semibold text-gray-900">
            <MessageSquare className="h-4 w-4 mr-2 text-epyc-primary" />
            Job texts
          </span>
          <span className="block text-sm text-gray-600 mt-1">{SMS_CONSENT_TEXT}</span>
          {!hasPhone && (
            <span className="block text-sm text-yellow-700 mt-1">Add a mobile number to your profile to get texts.</span>
          )}
        </span>
      </label>
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
