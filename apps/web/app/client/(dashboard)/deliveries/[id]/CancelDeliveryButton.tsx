'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface CancelDeliveryButtonProps {
  deliveryId: string;
}

export function CancelDeliveryButton({ deliveryId }: CancelDeliveryButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setLoading(true);
    setError(null);

    try {
      // Server route checks ownership and that no driver is assigned yet
      // (customers cannot update deliveries directly).
      const res = await fetch(`/api/client/deliveries/${deliveryId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not cancel. Try again.');
        setLoading(false);
        return;
      }
    } catch {
      setError('Network error. Check your connection and try again.');
      setLoading(false);
      return;
    }

    // Refresh the page to show updated status
    setLoading(false);
    setShowModal(false);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <XCircle className="h-4 w-4 mr-2" />
        Cancel Delivery
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !loading && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Cancel Delivery?
                </h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this delivery? Once a driver has been
              assigned, call (818) 217-0070 to cancel instead.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Delivery
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Yes, Cancel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
