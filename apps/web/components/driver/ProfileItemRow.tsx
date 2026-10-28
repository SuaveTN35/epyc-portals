'use client';

import { useRef, useState } from 'react';
import { CheckCircle, Clock, XCircle, Circle, Camera, Loader2, FileText } from 'lucide-react';
import type { ProfileItemDef } from '@/lib/driver-profile-items';
import type { ItemState } from '@/lib/driver-profile';

export const STATE_TEXT: Record<ItemState, string> = {
  approved: 'Approved',
  pending: 'Waiting for review',
  unreviewed: 'Waiting for review',
  rejected: 'Needs a new photo',
  missing: 'Not added yet',
  declared: 'You own this (photo optional)',
};

export function StateIcon({ state, className = 'h-5 w-5' }: { state: ItemState; className?: string }) {
  if (state === 'approved') return <CheckCircle className={`${className} text-green-600`} aria-label="Approved" />;
  if (state === 'pending' || state === 'unreviewed') return <Clock className={`${className} text-amber-500`} aria-label="Waiting for review" />;
  if (state === 'rejected') return <XCircle className={`${className} text-red-600`} aria-label="Rejected" />;
  if (state === 'declared') return <CheckCircle className={`${className} text-gray-400`} aria-label="Owned, no photo" />;
  return <Circle className={`${className} text-gray-300`} aria-label="Missing" />;
}

interface ProfileItemRowProps {
  def: ProfileItemDef;
  state: ItemState;
  reason?: string | null;
  /** Signed URL or blob URL for a thumbnail. */
  thumbUrl?: string | null;
  isPdf?: boolean;
  /** Upload handler for photo items; throws an Error with a driver-facing message. */
  onFile?: (file: File) => Promise<void>;
  /** Extra content under the row (e.g. the dimensions form). */
  children?: React.ReactNode;
  /** Gear only (declared, never required): whether the driver says they own it. */
  owned?: boolean;
  onOwnedChange?: (owned: boolean) => Promise<void> | void;
}

/** One checklist line: status icon, label, Required/Extra tag, thumbnail, take/retake. */
export function ProfileItemRow({ def, state, reason, thumbUrl, isPdf, onFile, children, owned, onOwnedChange }: ProfileItemRowProps) {
  const isGear = def.group === 'equipment';
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onFile) return;
    setBusy(true);
    setError(null);
    try {
      await onFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const buttonText = isGear
    ? state === 'missing' || state === 'declared'
      ? 'Add photo'
      : 'Retake'
    : state === 'missing'
    ? def.allowPdf
      ? 'Add'
      : 'Take photo'
    : 'Retake';

  const toggleOwned = async (next: boolean) => {
    if (!onOwnedChange) return;
    setBusy(true);
    setError(null);
    try {
      await onOwnedChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <StateIcon state={state} className="h-6 w-6 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{def.label}</span>
            {isGear ? null : def.required ? (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">Required</span>
            ) : (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">Optional</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{def.hint}</p>
          {isGear && onOwnedChange && (
            <label className="mt-1.5 inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-epyc-primary"
                checked={!!owned}
                disabled={busy}
                onChange={(e) => toggleOwned(e.target.checked)}
              />
              I own this
            </label>
          )}
          <p
            className={`text-xs mt-1 ${
              state === 'approved'
                ? 'text-green-700'
                : state === 'rejected'
                ? 'text-red-700'
                : state === 'missing' || state === 'declared'
                ? 'text-gray-500'
                : 'text-amber-700'
            }`}
          >
            {isGear && state === 'missing' ? 'Not listed' : STATE_TEXT[state]}
            {state === 'rejected' && reason ? `: ${reason}` : ''}
          </p>
          {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
        </div>
        {def.kind === 'photo' && (
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {thumbUrl ? (
              isPdf ? (
                <a href={thumbUrl} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-gray-400" />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt={def.label} className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
              )
            ) : null}
            {onFile && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept={def.allowPdf ? 'image/*,application/pdf' : 'image/*'}
                  {...(def.allowPdf ? {} : { capture: 'environment' as const })}
                  onChange={pick}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className={`inline-flex items-center text-sm px-3 py-2 rounded-lg touch-target disabled:opacity-50 ${
                    !isGear && (state === 'missing' || state === 'rejected')
                      ? 'bg-epyc-primary text-white'
                      : 'border border-gray-300 text-gray-700'
                  }`}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                  {busy ? '' : buttonText}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {children}
    </li>
  );
}
