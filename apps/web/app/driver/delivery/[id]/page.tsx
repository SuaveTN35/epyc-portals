'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Navigation,
  Phone,
  MessageSquare,
  Camera,
  Pencil,
  CheckCircle,
  MapPin,
  Package,
  Clock,
  Thermometer,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import { DELIVERY_STATUS_CONFIG, formatCurrency } from '@epyc/shared';
import type { Delivery } from '@epyc/shared';
import {
  LEFT_WITH_OPTIONS,
  MAX_ITEM_PHOTOS,
  MAX_PLACEMENT_PHOTOS,
  MAX_RECIPIENT_PHOTOS,
  buildDropoffProofRows,
  buildPickupProofRows,
  canDriverMoveTo,
  driverStepFor,
  validateDropoffProof,
  validatePickupProof,
  type LeftWith,
} from '@/lib/proof-flow';
import { ProofPhotoCapture, type CapturedPhoto } from '@/components/driver/ProofPhotoCapture';

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = params.id as string;

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showTempSheet, setShowTempSheet] = useState(false);
  const [showNavSheet, setShowNavSheet] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchDelivery = async () => {
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();

    setDelivery(data as Delivery);
    setLoading(false);
  };

  useEffect(() => {
    fetchDelivery();

    // Subscribe to delivery updates
    const channel = supabase
      .channel(`delivery:${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`,
        },
        (payload) => {
          setDelivery(payload.new as Delivery);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  /**
   * "I've arrived" buttons: move the job forward and log an arrival event with
   * GPS when the phone allows it. The status-change trigger also logs the
   * transition; this event adds where the driver was.
   */
  const arrive = async (target: 'arrived_pickup' | 'arrived_delivery') => {
    if (!delivery) return;
    if (!canDriverMoveTo(delivery.status, target)) {
      setStatusError(`This job cannot move from ${delivery.status} to ${target}. Call dispatch.`);
      return;
    }

    setUpdating(true);
    setStatusError(null);
    const gps = await getCurrentPosition();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('deliveries')
      .update({ status: target })
      .eq('id', deliveryId);

    if (error) {
      setStatusError(`Could not update status: ${error.message}`);
      setUpdating(false);
      return;
    }

    const { error: eventError } = await supabase.from('delivery_events').insert({
      delivery_id: deliveryId,
      event_type: target,
      old_status: delivery.status,
      new_status: target,
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
      notes: gps ? null : 'Location not available',
      created_by: user?.id ?? null,
    });
    if (eventError) {
      setStatusError(`Arrival saved, but the arrival log failed: ${eventError.message}`);
    }

    setUpdating(false);
    fetchDelivery();
  };

  const getNavigationAddress = () => {
    if (!delivery) return '';

    const isPickupPhase = ['assigned', 'en_route_pickup', 'arrived_pickup'].includes(delivery.status);
    return isPickupPhase
      ? `${delivery.pickup_address}, ${delivery.pickup_city}, ${delivery.pickup_state} ${delivery.pickup_zip}`
      : `${delivery.delivery_address}, ${delivery.delivery_city}, ${delivery.delivery_state} ${delivery.delivery_zip}`;
  };

  const getNavigationCoords = () => {
    if (!delivery) return null;

    const isPickupPhase = ['assigned', 'en_route_pickup', 'arrived_pickup'].includes(delivery.status);
    const lat = isPickupPhase ? delivery.pickup_lat : delivery.delivery_lat;
    const lng = isPickupPhase ? delivery.pickup_lng : delivery.delivery_lng;

    if (lat && lng) return { lat, lng };
    return null;
  };

  const openNavigation = (app: 'google' | 'apple' | 'waze') => {
    const address = getNavigationAddress();
    const coords = getNavigationCoords();

    let url = '';

    switch (app) {
      case 'google':
        if (coords) {
          url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
        } else {
          url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
        }
        break;

      case 'apple':
        if (coords) {
          url = `https://maps.apple.com/?daddr=${coords.lat},${coords.lng}`;
        } else {
          url = `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
        }
        break;

      case 'waze':
        if (coords) {
          url = `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
        } else {
          url = `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
        }
        break;
    }

    window.open(url, '_blank');
    setShowNavSheet(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Delivery not found</p>
      </div>
    );
  }

  const statusConfig = DELIVERY_STATUS_CONFIG[delivery.status];
  const isPickupPhase = ['assigned', 'en_route_pickup', 'arrived_pickup'].includes(delivery.status);
  const step = driverStepFor(delivery.status);

  const currentLocation = isPickupPhase
    ? {
        address: delivery.pickup_address,
        city: `${delivery.pickup_city}, ${delivery.pickup_state}`,
        contact: delivery.pickup_contact_name,
        phone: delivery.pickup_contact_phone,
        instructions: delivery.pickup_instructions,
      }
    : {
        address: delivery.delivery_address,
        city: `${delivery.delivery_city}, ${delivery.delivery_state}`,
        contact: delivery.delivery_contact_name,
        phone: delivery.delivery_contact_phone,
        instructions: delivery.delivery_instructions,
      };

  return (
    <div className="min-h-screen bg-gray-100 pb-32">
      {/* Header */}
      <header className="bg-epyc-primary text-white px-4 py-3 safe-area-top sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/driver/active')} className="p-2 -ml-2">
            <X className="h-6 w-6" />
          </button>
          <span className="font-medium">{delivery.tracking_number}</span>
          <div className={`px-2 py-1 rounded-full text-xs ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </div>
        </div>
      </header>

      {/* Map Placeholder */}
      <div className="h-48 bg-gray-300 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500">Map View</p>
        </div>
        <button
          onClick={() => setShowNavSheet(true)}
          className="absolute bottom-4 right-4 bg-epyc-primary text-white px-4 py-2 rounded-lg flex items-center shadow-lg"
        >
          <Navigation className="h-5 w-5 mr-2" />
          Navigate
        </button>
      </div>

      {/* Current Destination Card */}
      <div className="bg-white mx-4 -mt-6 rounded-xl shadow-lg p-4 relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              {isPickupPhase ? 'PICKUP LOCATION' : 'DELIVERY LOCATION'}
            </p>
            <p className="font-semibold text-gray-900">{currentLocation.address}</p>
            <p className="text-sm text-gray-500">{currentLocation.city}</p>
          </div>
          <div className={`p-2 rounded-full ${isPickupPhase ? 'bg-blue-100' : 'bg-green-100'}`}>
            <MapPin className={`h-5 w-5 ${isPickupPhase ? 'text-blue-600' : 'text-green-600'}`} />
          </div>
        </div>

        {/* Contact */}
        {currentLocation.contact && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{currentLocation.contact}</p>
                <p className="text-sm text-gray-500">{currentLocation.phone}</p>
              </div>
              <div className="flex space-x-2">
                {currentLocation.phone && (
                  <a
                    href={`tel:${currentLocation.phone}`}
                    className="p-3 bg-gray-100 rounded-full touch-target"
                  >
                    <Phone className="h-5 w-5 text-gray-600" />
                  </a>
                )}
                <button className="p-3 bg-gray-100 rounded-full touch-target">
                  <MessageSquare className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {currentLocation.instructions && (
          <div className="mt-4 bg-yellow-50 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">Instructions: </span>
              {currentLocation.instructions}
            </p>
          </div>
        )}
      </div>

      {/* Package Details */}
      <div className="bg-white mx-4 mt-4 rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Package Details</h3>
        <div className="space-y-2 text-sm">
          {delivery.package_description && (
            <div className="flex items-start">
              <Package className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
              <span className="text-gray-700">{delivery.package_description}</span>
            </div>
          )}
          {delivery.package_weight && (
            <div className="flex items-center text-gray-500">
              <span className="w-20">Weight:</span>
              <span className="text-gray-900">{delivery.package_weight} lbs</span>
            </div>
          )}
          {delivery.requires_signature && (
            <div className="flex items-center text-blue-600">
              <Pencil className="h-4 w-4 mr-2" />
              Signature required
            </div>
          )}
          {delivery.is_hipaa && (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              HIPAA compliant - chain of custody required
            </div>
          )}
          {delivery.requires_temperature_control && (
            <div className="flex items-center text-cyan-600">
              <Thermometer className="h-4 w-4 mr-2" />
              Temperature: {delivery.temperature_min}°C - {delivery.temperature_max}°C
              <button
                onClick={() => setShowTempSheet(true)}
                className="ml-2 text-xs bg-cyan-100 px-2 py-1 rounded"
              >
                Log Temp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payout */}
      <div className="bg-white mx-4 mt-4 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Your payout</span>
          <span className="text-xl font-bold text-epyc-primary">
            {formatCurrency(delivery.driver_payout || 0)}
          </span>
        </div>
        {delivery.tip_amount && delivery.tip_amount > 0 && (
          <div className="flex items-center justify-between mt-2 text-sm">
            <span className="text-gray-500">+ Tip</span>
            <span className="text-green-600 font-medium">
              {formatCurrency(delivery.tip_amount)}
            </span>
          </div>
        )}
      </div>

      {/* Next step */}
      <div className="bg-white mx-4 mt-4 rounded-xl shadow-sm p-4">
        {(step === 'to_pickup' || step === 'to_dropoff') && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">
              {step === 'to_pickup' ? 'Step 1: Go to pickup' : 'Step 3: Go to drop-off'}
            </h3>
            <button
              onClick={() => setShowNavSheet(true)}
              className="w-full py-4 border-2 border-epyc-primary text-epyc-primary rounded-xl font-semibold text-lg flex items-center justify-center touch-target"
            >
              <Navigation className="h-6 w-6 mr-2" />
              {step === 'to_pickup' ? 'Navigate to pickup' : 'Navigate to drop-off'}
            </button>
            <button
              onClick={() => arrive(step === 'to_pickup' ? 'arrived_pickup' : 'arrived_delivery')}
              disabled={updating}
              className="w-full py-4 bg-epyc-primary text-white rounded-xl font-semibold text-lg flex items-center justify-center touch-target disabled:opacity-50"
            >
              {updating ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <MapPin className="h-6 w-6 mr-2" />
                  {step === 'to_pickup' ? "I've arrived at pickup" : "I've arrived at drop-off"}
                </>
              )}
            </button>
          </div>
        )}

        {step === 'pickup_proof' && (
          <PickupProofPanel deliveryId={deliveryId} onDone={fetchDelivery} />
        )}

        {step === 'dropoff_proof' && (
          <DropoffProofPanel
            deliveryId={deliveryId}
            requiresSignature={!!delivery.requires_signature}
            onDone={() => router.push('/driver/earnings')}
          />
        )}

        {step === 'done' && (
          <div className="text-center py-2">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="font-medium text-gray-900">
              {delivery.status === 'delivered' ? 'Delivery complete' : statusConfig.label}
            </p>
          </div>
        )}
      </div>

      {statusError && (
        <div className="fixed top-4 left-4 right-4 z-40 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 shadow">
          {statusError}
          <button onClick={() => setStatusError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Temperature Log Sheet */}
      {showTempSheet && (
        <TemperatureSheet
          deliveryId={deliveryId}
          minTemp={delivery.temperature_min || 2}
          maxTemp={delivery.temperature_max || 8}
          onClose={() => setShowTempSheet(false)}
        />
      )}

      {/* Navigation App Selector */}
      {showNavSheet && (
        <NavigationSheet
          onSelect={openNavigation}
          onClose={() => setShowNavSheet(false)}
        />
      )}
    </div>
  );
}

/** Best-effort GPS fix; resolves null if unavailable or denied. */
function getCurrentPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

/**
 * Finger or stylus signature pad on a plain canvas (no extra dependency).
 * Calls onChange with a PNG data URL after each stroke, or null when cleared.
 */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Size the backing store to the displayed size and device pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const pointFor = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointFor(e);
    lastPointRef.current = p;
    const ctx = e.currentTarget.getContext('2d');
    if (ctx) {
      // A dot, so a single tap still leaves a mark.
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#111827';
      ctx.fill();
    }
    hasInkRef.current = true;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext('2d');
    const last = lastPointRef.current;
    const p = pointFor(e);
    if (ctx && last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastPointRef.current = p;
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (hasInkRef.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    hasInkRef.current = false;
    onChange(null);
  };

  return (
    <div>
      <div className="relative bg-white border-2 border-dashed border-gray-300 rounded-xl">
        <canvas
          ref={canvasRef}
          className="w-full h-48 rounded-xl"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
          aria-label="Signature pad"
        />
        <p className="absolute bottom-2 left-3 text-xs text-gray-400 pointer-events-none">
          Recipient signs here
        </p>
      </div>
      <div className="flex justify-end mt-2">
        <button type="button" onClick={clear} className="text-sm text-gray-600 underline">
          Clear
        </button>
      </div>
    </div>
  );
}

function ProofError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
      <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

/**
 * Step 2: at pickup. Item photos (1-4) and the receipt or bill of lading
 * (or "No receipt given" with a note). Proof rows are saved first; only then
 * is the job marked picked_up. The database refuses picked_up without them.
 */
function PickupProofPanel({ deliveryId, onDone }: { deliveryId: string; onDone: () => void }) {
  const supabase = createClient();
  const [itemPhotos, setItemPhotos] = useState<CapturedPhoto[]>([]);
  const [receiptPhotos, setReceiptPhotos] = useState<CapturedPhoto[]>([]);
  const [noReceipt, setNoReceipt] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [proofSaved, setProofSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = {
    itemPhotos: itemPhotos.map((p) => p.path),
    receiptPhotos: receiptPhotos.map((p) => p.path),
    noReceipt,
    note,
  };

  const complete = async () => {
    setError(null);
    const problem = validatePickupProof(input);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    const capturedAt = new Date().toISOString();

    // Proof first. A retry after a failed status update does not re-insert.
    if (!proofSaved) {
      const gps = await getCurrentPosition();
      const rows = buildPickupProofRows(deliveryId, input, gps, capturedAt);
      const { error: podError } = await supabase.from('proof_of_delivery').insert(rows);
      if (podError) {
        setSaving(false);
        setError(`Could not save pickup proof: ${podError.message}. Pickup is NOT complete yet; try again.`);
        return;
      }
      setProofSaved(true);
    }

    const { error: statusError } = await supabase
      .from('deliveries')
      .update({ status: 'picked_up', actual_pickup_time: capturedAt })
      .eq('id', deliveryId);

    setSaving(false);
    if (statusError) {
      setError(`Proof saved, but marking the job picked up failed: ${statusError.message}. Tap again or call dispatch.`);
      return;
    }
    onDone();
  };

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-gray-900">Step 2: Pickup proof</h3>
      <ProofError message={error} />

      <ProofPhotoCapture
        deliveryId={deliveryId}
        stage="pickup"
        kind="item"
        label="Photo of the item(s)"
        hint="Show every piece you are taking."
        required
        max={MAX_ITEM_PHOTOS}
        photos={itemPhotos}
        onChange={setItemPhotos}
        disabled={saving || proofSaved}
      />

      {!noReceipt && (
        <ProofPhotoCapture
          deliveryId={deliveryId}
          stage="pickup"
          kind="receipt"
          label="Photo of the receipt / bill of lading"
          required
          max={2}
          photos={receiptPhotos}
          onChange={setReceiptPhotos}
          disabled={saving || proofSaved}
        />
      )}

      <label className="flex items-center gap-3 text-sm text-gray-800">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-gray-300"
          checked={noReceipt}
          disabled={saving || proofSaved}
          onChange={(e) => setNoReceipt(e.target.checked)}
        />
        No receipt given
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note{noReceipt && <span className="text-red-500 ml-1">*</span>}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving || proofSaved}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder={noReceipt ? 'Why was there no receipt?' : 'Optional'}
        />
      </div>

      <button
        onClick={complete}
        disabled={saving}
        className="w-full py-4 bg-epyc-primary text-white rounded-xl font-semibold text-lg flex items-center justify-center touch-target disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Pickup complete'}
      </button>
    </div>
  );
}

/**
 * Step 4: at drop-off. Recipient name, where it was left, placement photo
 * (required), recipient photo (optional), and a signature when the job
 * requires one (or "Left without signature" with a note). Proof rows are
 * saved first; only then is the job marked delivered.
 */
function DropoffProofPanel({
  deliveryId,
  requiresSignature,
  onDone,
}: {
  deliveryId: string;
  requiresSignature: boolean;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [recipientName, setRecipientName] = useState('');
  const [leftWith, setLeftWith] = useState<LeftWith | ''>('');
  const [note, setNote] = useState('');
  const [placementPhotos, setPlacementPhotos] = useState<CapturedPhoto[]>([]);
  const [recipientPhotos, setRecipientPhotos] = useState<CapturedPhoto[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [noSignature, setNoSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proofSaved, setProofSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = {
    recipientName,
    leftWith,
    note,
    placementPhotos: placementPhotos.map((p) => p.path),
    recipientPhotos: recipientPhotos.map((p) => p.path),
    signature,
    requiresSignature,
    noSignature,
  };

  const complete = async () => {
    setError(null);
    const problem = validateDropoffProof(input);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    const capturedAt = new Date().toISOString();

    if (!proofSaved) {
      const gps = await getCurrentPosition();
      const rows = buildDropoffProofRows(deliveryId, input, gps, capturedAt);
      const { error: podError } = await supabase.from('proof_of_delivery').insert(rows);
      if (podError) {
        setSaving(false);
        setError(`Could not save proof of delivery: ${podError.message}. The delivery is NOT complete yet; try again.`);
        return;
      }
      setProofSaved(true);
    }

    const { error: statusError } = await supabase
      .from('deliveries')
      .update({ status: 'delivered', actual_delivery_time: capturedAt })
      .eq('id', deliveryId);

    if (statusError) {
      setSaving(false);
      setError(`Proof saved, but marking the job delivered failed: ${statusError.message}. Tap again or call dispatch.`);
      return;
    }

    // Free the driver for the next job.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: releaseError } = await supabase
        .from('drivers')
        .update({ current_delivery_id: null, last_active_at: capturedAt })
        .eq('profile_id', user.id)
        .eq('current_delivery_id', deliveryId);
      if (releaseError) {
        setSaving(false);
        setError(`Delivered. Could not clear your current job: ${releaseError.message}. Tell dispatch.`);
        return;
      }
    }

    setSaving(false);
    onDone();
  };

  const locked = saving || proofSaved;

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-gray-900">Step 4: Drop-off proof</h3>
      <ProofError message={error} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Recipient name<span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          disabled={locked}
          className="w-full px-3 py-3 border border-gray-300 rounded-lg"
          placeholder="Who received it"
          autoComplete="off"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Left with / where left<span className="text-red-500 ml-1">*</span>
        </label>
        <select
          value={leftWith}
          onChange={(e) => setLeftWith(e.target.value as LeftWith | '')}
          disabled={locked}
          className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-white"
        >
          <option value="">Choose one</option>
          {LEFT_WITH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <ProofPhotoCapture
        deliveryId={deliveryId}
        stage="delivery"
        kind="placement"
        label="Photo showing where it was left"
        required
        max={MAX_PLACEMENT_PHOTOS}
        photos={placementPhotos}
        onChange={setPlacementPhotos}
        disabled={locked}
      />

      <ProofPhotoCapture
        deliveryId={deliveryId}
        stage="delivery"
        kind="recipient"
        label="Photo of who it was left with (optional)"
        max={MAX_RECIPIENT_PHOTOS}
        photos={recipientPhotos}
        onChange={setRecipientPhotos}
        disabled={locked}
      />

      {!noSignature && (
        <div>
          <p className="text-sm font-medium text-gray-900 mb-1">
            Signature
            {requiresSignature ? (
              <span className="text-red-500 ml-1">*</span>
            ) : (
              <span className="ml-1 text-xs font-normal text-gray-500">(optional)</span>
            )}
          </p>
          <SignaturePad onChange={setSignature} />
        </div>
      )}

      {requiresSignature && (
        <label className="flex items-center gap-3 text-sm text-gray-800">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-gray-300"
            checked={noSignature}
            disabled={locked}
            onChange={(e) => {
              setNoSignature(e.target.checked);
              if (e.target.checked) setSignature(null);
            }}
          />
          Left without signature
        </label>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note{noSignature && <span className="text-red-500 ml-1">*</span>}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={locked}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder={noSignature ? 'Why was there no signature?' : 'Optional'}
        />
      </div>

      <button
        onClick={complete}
        disabled={saving}
        className="w-full py-4 bg-epyc-primary text-white rounded-xl font-semibold text-lg flex items-center justify-center touch-target disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Complete delivery'}
      </button>
    </div>
  );
}

function TemperatureSheet({
  deliveryId,
  minTemp,
  maxTemp,
  onClose,
}: {
  deliveryId: string;
  minTemp: number;
  maxTemp: number;
  onClose: () => void;
}) {
  const [temperature, setTemperature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async () => {
    const temp = parseFloat(temperature);
    if (isNaN(temp)) return;

    setSubmitting(true);

    // Get current location
    let lat, lng;
    if (navigator.geolocation) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }).catch(() => null);

      if (position) {
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }
    }

    // Get driver ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      setError('Your session expired. Sign in again.');
      return;
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    // Log temperature
    const { error: logError } = await supabase.from('temperature_logs').insert({
      delivery_id: deliveryId,
      driver_id: driver?.id,
      temperature: temp,
      lat,
      lng,
    });

    // Also save as POD
    const { error: podError } = await supabase.from('proof_of_delivery').insert({
      delivery_id: deliveryId,
      type: 'temperature',
      temperature_reading: temp,
      lat,
      lng,
    });

    setSubmitting(false);
    if (logError || podError) {
      setError(`Could not save the reading: ${(logError || podError)?.message}`);
      return;
    }
    onClose();
  };

  const temp = parseFloat(temperature);
  const isOutOfRange = !isNaN(temp) && (temp < minTemp || temp > maxTemp);

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl slide-up safe-area-bottom">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Log Temperature</h3>
            <button onClick={onClose} className="p-2">
              <X className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-cyan-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-cyan-800">
              Required range: {minTemp}°C - {maxTemp}°C
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Temperature (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className={`w-full px-4 py-3 text-2xl text-center border rounded-lg ${
                isOutOfRange ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="0.0"
            />
          </div>

          {error && (
            <div className="bg-red-50 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
          )}

          {isOutOfRange && (
            <div className="bg-red-50 rounded-lg p-3 mb-4 flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700">
                Temperature is out of range! Dispatch will be notified.
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !temperature}
            className="w-full py-3 bg-epyc-primary text-white rounded-lg font-medium flex items-center justify-center disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Log Temperature'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NavigationSheet({
  onSelect,
  onClose,
}: {
  onSelect: (app: 'google' | 'apple' | 'waze') => void;
  onClose: () => void;
}) {
  const navApps = [
    {
      id: 'google' as const,
      name: 'Google Maps',
      icon: (
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4285F4"/>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.28-.59.65-1.2 1.09-1.84L12 2z" fill="#34A853"/>
          <path d="M5 9c0-1.74.5-3.37 1.41-4.84.28.59.65 1.2 1.09 1.84L12 22s1.3-1.44 2.78-3.51L5 9z" fill="#FBBC05"/>
          <path d="M12 22s1.3-1.44 2.78-3.51c1.12-1.56 2.28-3.39 3.11-5.15.55-1.17.92-2.34 1.05-3.34H12l4.59 8.49L12 22z" fill="#EA4335"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
      ),
      color: 'bg-white border-2 border-gray-200',
    },
    {
      id: 'apple' as const,
      name: 'Apple Maps',
      icon: (
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#000"/>
          <path d="M12 5c-2.76 0-5 2.24-5 5 0 4.5 5 9 5 9s5-4.5 5-9c0-2.76-2.24-5-5-5z" fill="#fff"/>
          <circle cx="12" cy="10" r="2" fill="#000"/>
        </svg>
      ),
      color: 'bg-white border-2 border-gray-200',
    },
    {
      id: 'waze' as const,
      name: 'Waze',
      icon: (
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#33CCFF"/>
          <ellipse cx="12" cy="11" rx="7" ry="6" fill="white"/>
          <circle cx="9" cy="10" r="1.5" fill="#33CCFF"/>
          <circle cx="15" cy="10" r="1.5" fill="#33CCFF"/>
          <path d="M9 13.5c0 0 1.5 2 3 2s3-2 3-2" stroke="#33CCFF" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M17.5 14.5c1 1 2.5 1.5 3.5 0.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      color: 'bg-white border-2 border-gray-200',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl slide-up safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Choose Navigation App</h3>
            <button onClick={onClose} className="p-2">
              <X className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {navApps.map((app) => (
            <button
              key={app.id}
              onClick={() => onSelect(app.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl ${app.color} hover:bg-gray-50 transition-colors touch-target`}
            >
              {app.icon}
              <span className="font-medium text-gray-900">{app.name}</span>
              <Navigation className="h-5 w-5 text-gray-400 ml-auto" />
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs text-center text-gray-500">
            Tap to open directions in your preferred app
          </p>
        </div>
      </div>
    </div>
  );
}
