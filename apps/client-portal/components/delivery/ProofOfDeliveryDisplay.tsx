'use client';

import { useState } from 'react';
import { Camera, PenTool, X, ZoomIn, Clock, MapPin } from 'lucide-react';

interface ProofOfDelivery {
  id: string;
  delivery_id: string;
  photo_url?: string | null;
  signature_url?: string | null;
  recipient_name?: string | null;
  notes?: string | null;
  captured_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface ProofOfDeliveryDisplayProps {
  pod: ProofOfDelivery | null;
  requiresSignature?: boolean;
}

export function ProofOfDeliveryDisplay({
  pod,
  requiresSignature = false,
}: ProofOfDeliveryDisplayProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!pod) {
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

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h3>

        <div className="space-y-6">
          {/* Photo */}
          {pod.photo_url && (
            <div>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <Camera className="h-4 w-4 mr-1" />
                Delivery Photo
              </div>
              <div
                className="relative group cursor-pointer rounded-lg overflow-hidden"
                onClick={() => setLightboxImage(pod.photo_url!)}
              >
                <img
                  src={pod.photo_url}
                  alt="Proof of delivery"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          )}

          {/* Signature */}
          {pod.signature_url && (
            <div>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <PenTool className="h-4 w-4 mr-1" />
                Signature
              </div>
              <div
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-50 p-4"
                onClick={() => setLightboxImage(pod.signature_url!)}
              >
                <img
                  src={pod.signature_url}
                  alt="Signature"
                  className="max-h-24 mx-auto"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {pod.recipient_name && (
                <p className="text-sm text-gray-600 mt-2">
                  Signed by: <span className="font-medium">{pod.recipient_name}</span>
                </p>
              )}
            </div>
          )}

          {/* No signature warning */}
          {requiresSignature && !pod.signature_url && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-700">
                Signature was required but not captured
              </p>
            </div>
          )}

          {/* Notes */}
          {pod.notes && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Driver Notes</div>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{pod.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-2" />
              Captured: {formatTimestamp(pod.captured_at)}
            </div>
            {pod.latitude && pod.longitude && (
              <div className="flex items-center text-sm text-gray-500">
                <MapPin className="h-4 w-4 mr-2" />
                GPS: {pod.latitude.toFixed(6)}, {pod.longitude.toFixed(6)}
              </div>
            )}
          </div>
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
