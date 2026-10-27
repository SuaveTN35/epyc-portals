'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, PenTool, X, ZoomIn, Clock, Loader2, RefreshCw } from 'lucide-react';

// Shape returned by GET /api/client/deliveries/:id/proof. Photo URLs are
// short-lived signed URLs; the raw storage paths never reach the browser.
interface CustomerProof {
  photos: string[];
  signature: string | null;
  recipient_name: string | null;
  recipient_relation: string | null;
  notes: string[];
  captured_at: string | null;
}

interface ProofOfDeliveryDisplayProps {
  deliveryId: string;
  requiresSignature?: boolean;
}

export function ProofOfDeliveryDisplay({
  deliveryId,
  requiresSignature = false,
}: ProofOfDeliveryDisplayProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [proof, setProof] = useState<CustomerProof | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/deliveries/${deliveryId}/proof`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not load proof of delivery');
      }
      setProof(data as CustomerProof);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load proof of delivery');
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    load();
  }, [load]);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h3>
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h3>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="inline-flex items-center text-red-700 hover:underline">
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasProof =
    !!proof && (proof.photos.length > 0 || !!proof.signature || proof.notes.length > 0);

  if (!proof || !hasProof) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h3>
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Camera className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            Proof of delivery will appear here once the package is delivered
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h3>

        <div className="space-y-6">
          {/* Where it was left */}
          {proof.photos.length > 0 && (
            <div>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <Camera className="h-4 w-4 mr-1" />
                Delivery Photo{proof.photos.length > 1 ? 's' : ''}
              </div>
              <div className={proof.photos.length > 1 ? 'grid grid-cols-2 gap-2' : ''}>
                {proof.photos.map((url, i) => (
                  <div
                    key={i}
                    className="relative group cursor-pointer rounded-lg overflow-hidden"
                    onClick={() => setLightboxImage(url)}
                  >
                    <img src={url} alt="Proof of delivery" className="w-full h-48 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Photo links expire after a few minutes.{' '}
                <button onClick={load} className="underline">
                  Reload
                </button>
              </p>
            </div>
          )}

          {/* Signature */}
          {proof.signature && (
            <div>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <PenTool className="h-4 w-4 mr-1" />
                Signature
              </div>
              <div
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-50 p-4"
                onClick={() => setLightboxImage(proof.signature)}
              >
                <img src={proof.signature} alt="Signature" className="max-h-24 mx-auto" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          )}

          {proof.recipient_name && (
            <p className="text-sm text-gray-600">
              Received by: <span className="font-medium">{proof.recipient_name}</span>
              {proof.recipient_relation ? ` (${proof.recipient_relation})` : ''}
            </p>
          )}

          {/* No signature warning */}
          {requiresSignature && !proof.signature && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-700">
                Signature was required but not captured
              </p>
            </div>
          )}

          {/* Notes */}
          {proof.notes.length > 0 && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Driver Notes</div>
              {proof.notes.map((n, i) => (
                <p key={i} className="text-gray-700 bg-gray-50 rounded-lg p-3 mb-1">
                  {n}
                </p>
              ))}
            </div>
          )}

          {/* Metadata */}
          {proof.captured_at && (
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-2" />
                Captured: {formatTimestamp(proof.captured_at)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxImage}
            alt="Enlarged view"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
