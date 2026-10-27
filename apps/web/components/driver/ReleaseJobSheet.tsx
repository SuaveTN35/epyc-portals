'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { RELEASE_REASONS, type ReleaseReason } from '@/lib/driver-job';

/** Give a job back to dispatch before pickup. Calls the release route. */
export function ReleaseJobSheet({
  deliveryId,
  onClose,
  onReleased,
}: {
  deliveryId: string;
  onClose: () => void;
  onReleased: () => void;
}) {
  const [reason, setReason] = useState<ReleaseReason | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    if (reason === 'other' && note.trim().length < 3) {
      setError('Add a short note for Other.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/driver/deliveries/${deliveryId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Could not release the job. Call dispatch.');
        return;
      }
      onReleased();
    } catch {
      setError('Could not reach the server. Check your signal and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl slide-up safe-area-bottom">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Release this job</h3>
          <button onClick={onClose} className="p-2" disabled={saving}>
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            The job goes back to dispatch to give to another driver.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReleaseReason | '')}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">Choose one</option>
              {RELEASE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note{reason === 'other' && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          {error && <p className="text-sm text-red-700 bg-red-50 rounded p-2">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-4 bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center touch-target disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Release job'}
          </button>
        </div>
      </div>
    </div>
  );
}
