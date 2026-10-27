'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { shrinkImage, isImageFile } from '@/lib/upload-client';
import { proofPhotoPath, type PhotoKind } from '@/lib/proof-flow';

export interface CapturedPhoto {
  path: string;
  preview: string;
}

interface ProofPhotoCaptureProps {
  deliveryId: string;
  stage: 'pickup' | 'delivery';
  kind: PhotoKind;
  label: string;
  hint?: string;
  required?: boolean;
  max: number;
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
  disabled?: boolean;
  /** Override the storage path (must still start with `<deliveryId>/`). */
  pathFor?: () => string;
}

/**
 * Camera capture for proof photos. Each photo is shrunk in the browser
 * (phone photos are 5-12 MB) and uploaded straight to the private
 * delivery-photos bucket under <deliveryId>/. The parent saves the returned
 * storage paths as proof_of_delivery rows.
 */
export function ProofPhotoCapture({
  deliveryId,
  stage,
  kind,
  label,
  hint,
  required,
  max,
  photos,
  onChange,
  disabled,
  pathFor,
}: ProofPhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke every preview URL this component created when it unmounts.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file after an error.
    e.target.value = '';
    if (!file) return;

    setError(null);
    if (!isImageFile(file)) {
      setError('Please take or choose a photo.');
      return;
    }

    setUploading(true);
    try {
      const prepared = await shrinkImage(file);
      const path = pathFor ? pathFor() : proofPhotoPath(deliveryId, stage, kind);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('delivery-photos')
        .upload(path, prepared, {
          contentType: prepared.type || 'image/jpeg',
          upsert: false,
        });
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}. Check your signal and try again.`);
        return;
      }
      onChange([...photos, { path, preview: URL.createObjectURL(prepared) }]);
    } catch (err) {
      setError(
        `Photo upload failed: ${err instanceof Error ? err.message : 'unknown error'}. Try again.`
      );
    } finally {
      setUploading(false);
    }
  };

  const remove = (index: number) => {
    const target = photos[index];
    if (target) URL.revokeObjectURL(target.preview);
    onChange(photos.filter((_, i) => i !== index));
  };

  const full = photos.length >= max;

  return (
    <div>
      <p className="text-sm font-medium text-gray-900">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        <span className="ml-2 text-xs font-normal text-gray-500">
          {photos.length}/{max}
        </span>
      </p>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 my-2">
          {photos.map((p, i) => (
            <div key={p.path} className="relative">
              <img
                src={p.preview}
                alt={`${label} ${i + 1}`}
                className="w-full h-20 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                className="absolute -top-2 -right-2 bg-white rounded-full shadow p-1"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || disabled}
          className="w-full py-4 mt-1 border-2 border-dashed border-epyc-primary text-epyc-primary rounded-xl font-semibold flex items-center justify-center touch-target disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Camera className="h-6 w-6 mr-2" />
              {photos.length === 0 ? 'Take photo' : 'Add another photo'}
            </>
          )}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
