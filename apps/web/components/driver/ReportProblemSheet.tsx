'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  EXCEPTION_REASONS,
  exceptionEventNote,
  validateException,
  type ExceptionReason,
} from '@/lib/driver-job';
import { ProofPhotoCapture, type CapturedPhoto } from './ProofPhotoCapture';

/**
 * "Report a problem" at any step after assignment. Logs a delivery_events
 * row (event_type 'exception') with GPS and time; dispatch sees it at the
 * top of the job and the dashboard until a dispatcher marks it resolved.
 * The job stays with the driver.
 */
export function ReportProblemSheet({
  deliveryId,
  stage,
  currentStatus,
  getPosition,
  onClose,
  onReported,
}: {
  deliveryId: string;
  stage: 'pickup' | 'delivery';
  currentStatus: string;
  getPosition: () => Promise<{ lat: number; lng: number } | null>;
  onClose: () => void;
  onReported: () => void;
}) {
  const [reason, setReason] = useState<ExceptionReason | ''>('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const submit = async () => {
    setError(null);
    const problem = validateException(reason, note);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const gps = await getPosition();
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: eventError } = await supabase.from('delivery_events').insert({
      delivery_id: deliveryId,
      event_type: 'exception',
      old_status: currentStatus,
      new_status: currentStatus,
      notes: exceptionEventNote(reason as ExceptionReason, note),
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
      created_by: user?.id ?? null,
    });
    if (eventError) {
      setSaving(false);
      setError(`Could not send the report: ${eventError.message}. Call dispatch.`);
      return;
    }

    if (photos.length > 0) {
      // No notes on this row on purpose: proof checks treat notes as
      // no-receipt / no-signature explanations.
      const { error: podError } = await supabase.from('proof_of_delivery').insert(
        photos.map((p) => ({
          delivery_id: deliveryId,
          type: 'photo',
          stage,
          photo_kind: 'other',
          photo_url: p.path,
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
          captured_at: now,
        }))
      );
      if (podError) {
        setSaving(false);
        setError(`Report sent, but the photo did not save: ${podError.message}.`);
        return;
      }
    }

    setSaving(false);
    onReported();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl slide-up safe-area-bottom max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Report a problem</h3>
          <button onClick={onClose} className="p-2" disabled={saving}>
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">Dispatch is alerted. The job stays with you.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What is wrong?<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ExceptionReason | '')}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">Choose one</option>
              {EXCEPTION_REASONS.map((r) => (
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
          <ProofPhotoCapture
            deliveryId={deliveryId}
            stage={stage}
            kind="other"
            label="Photo (optional)"
            max={1}
            photos={photos}
            onChange={setPhotos}
            disabled={saving}
            pathFor={() => `${deliveryId}/exception-${Date.now()}.jpg`}
          />
          {error && <p className="text-sm text-red-700 bg-red-50 rounded p-2">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-4 bg-orange-600 text-white rounded-xl font-semibold flex items-center justify-center touch-target disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Send report'}
          </button>
        </div>
      </div>
    </div>
  );
}
