'use client';

import { useId, useState } from 'react';
import { DELETE_CONFIRM_WORD } from '@/lib/account-deletion-copy';

/**
 * In-app account deletion for customers and drivers (App Store 5.1.1(v),
 * Google Play account deletion policy). Two steps: open, then type DELETE.
 */
export function DeleteAccount({ audience }: { audience: 'customer' | 'driver' }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const ready = typed.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again, or email admin@epyccs.com.');
        setBusy(false);
        return;
      }
      window.location.assign('/account-deleted');
    } catch {
      setError('No connection. Check your signal and try again.');
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${hintId}-heading`} className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
      <h2 id={`${hintId}-heading`} className="text-lg font-semibold text-red-700">
        Delete account
      </h2>
      <p className="text-base text-gray-700 mt-2">
        This removes your sign-in and your personal details
        {audience === 'driver' ? ', including your license, insurance and vehicle photos and your location history' : ''}.
        Past delivery records stay for tax and legal reasons, without your name or contact details. This cannot be undone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 min-h-[44px] px-4 py-2 text-base font-medium text-red-700 border border-red-400 rounded-lg hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <label htmlFor={inputId} className="block text-base font-medium text-gray-900">
            Type {DELETE_CONFIRM_WORD} to confirm
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            // Focus moves to the field the moment it appears (WCAG 2.4.3).
            autoFocus
            autoCapitalize="characters"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className="block w-full max-w-xs min-h-[44px] px-3 py-2 text-base border border-gray-500 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          />
          {error && (
            <p id={errorId} role="alert" className="text-base text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!ready || busy}
              aria-disabled={!ready || busy}
              className="min-h-[44px] px-4 py-2 text-base font-semibold text-white bg-red-700 rounded-lg disabled:bg-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              {busy ? 'Deleting...' : 'Delete my account for good'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError(null);
              }}
              className="min-h-[44px] px-4 py-2 text-base font-medium text-gray-800 border border-gray-500 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-700 focus-visible:ring-offset-2"
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
