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
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react';
import { DELIVERY_STATUS_CONFIG, canDriverUpdateStatus, formatCurrency } from '@epyc/shared';
import type { Delivery, DeliveryStatus } from '@epyc/shared';

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = params.id as string;

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showPODSheet, setShowPODSheet] = useState(false);
  const [showTempSheet, setShowTempSheet] = useState(false);
  const [showNavSheet, setShowNavSheet] = useState(false);

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

  const updateStatus = async (newStatus: DeliveryStatus) => {
    if (!delivery || !canDriverUpdateStatus(delivery.status, newStatus)) return;

    setUpdating(true);

    const updates: Partial<Delivery> = { status: newStatus };

    // Add timestamp for specific status changes
    if (newStatus === 'picked_up') {
      updates.actual_pickup_time = new Date().toISOString();
    } else if (newStatus === 'delivered') {
      updates.actual_delivery_time = new Date().toISOString();
      setShowPODSheet(true);
      setUpdating(false);
      return;
    }

    await supabase
      .from('deliveries')
      .update(updates)
      .eq('id', deliveryId);

    setUpdating(false);
    fetchDelivery();
  };

  const getNextStatus = (): { status: DeliveryStatus; label: string } | null => {
    if (!delivery) return null;

    const statusFlow: Record<DeliveryStatus, { status: DeliveryStatus; label: string } | null> = {
      assigned: { status: 'en_route_pickup', label: 'Start Navigation to Pickup' },
      en_route_pickup: { status: 'arrived_pickup', label: 'Arrived at Pickup' },
      arrived_pickup: { status: 'picked_up', label: 'Package Picked Up' },
      picked_up: { status: 'en_route_delivery', label: 'Start Navigation to Delivery' },
      en_route_delivery: { status: 'arrived_delivery', label: 'Arrived at Delivery' },
      arrived_delivery: { status: 'delivered', label: 'Complete Delivery' },
      // Terminal states
      quote_requested: null,
      quoted: null,
      booked: null,
      delivered: null,
      cancelled: null,
      failed: null,
    };

    return statusFlow[delivery.status];
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
  const nextAction = getNextStatus();

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
          <button onClick={() => router.push('/active')} className="p-2 -ml-2">
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

      {/* Action Button */}
      {nextAction && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
          <button
            onClick={() => updateStatus(nextAction.status)}
            disabled={updating}
            className="w-full py-4 bg-epyc-primary text-white rounded-xl font-semibold text-lg flex items-center justify-center touch-target disabled:opacity-50"
          >
            {updating ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ChevronUp className="h-6 w-6 mr-2" />
                {nextAction.label}
              </>
            )}
          </button>
        </div>
      )}

      {/* POD Bottom Sheet */}
      {showPODSheet && (
        <PODBottomSheet
          deliveryId={deliveryId}
          requiresSignature={delivery.requires_signature}
          onClose={() => setShowPODSheet(false)}
          onComplete={() => {
            setShowPODSheet(false);
            router.push('/earnings');
          }}
        />
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

function PODBottomSheet({
  deliveryId,
  requiresSignature,
  onClose,
  onComplete,
}: {
  deliveryId: string;
  requiresSignature: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<'photo' | 'signature' | 'confirm'>('photo');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload to Supabase Storage
    const fileName = `pod/${deliveryId}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('delivery-photos')
      .upload(fileName, file);

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('delivery-photos')
        .getPublicUrl(fileName);
      setPhotoUrl(urlData.publicUrl);
      setStep(requiresSignature ? 'signature' : 'confirm');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    // Save POD records
    if (photoUrl) {
      await supabase.from('proof_of_delivery').insert({
        delivery_id: deliveryId,
        type: 'photo',
        photo_url: photoUrl,
      });
    }

    if (signatureData) {
      await supabase.from('proof_of_delivery').insert({
        delivery_id: deliveryId,
        type: 'signature',
        signature_data: signatureData,
        recipient_name: recipientName,
      });
    }

    // Update delivery status
    await supabase
      .from('deliveries')
      .update({
        status: 'delivered',
        actual_delivery_time: new Date().toISOString(),
      })
      .eq('id', deliveryId);

    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl slide-up safe-area-bottom">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Proof of Delivery</h3>
            <button onClick={onClose} className="p-2">
              <X className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {step === 'photo' && (
            <div className="text-center">
              <div className="bg-gray-100 rounded-xl p-8 mb-4">
                {photoUrl ? (
                  <img src={photoUrl} alt="POD" className="w-full rounded-lg" />
                ) : (
                  <Camera className="h-16 w-16 text-gray-400 mx-auto" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-epyc-primary text-white rounded-lg font-medium"
              >
                {photoUrl ? 'Retake Photo' : 'Take Photo of Package'}
              </button>
            </div>
          )}

          {step === 'signature' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter recipient's name"
                />
              </div>
              <div className="bg-gray-100 rounded-xl p-4 mb-4 h-48 flex items-center justify-center">
                <p className="text-gray-500">Signature Canvas</p>
                {/* In production, use react-signature-canvas here */}
              </div>
              <button
                onClick={() => {
                  setSignatureData('mock-signature-data');
                  setStep('confirm');
                }}
                className="w-full py-3 bg-epyc-primary text-white rounded-lg font-medium"
              >
                Confirm Signature
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <div className="bg-green-50 rounded-xl p-4 mb-4 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="font-medium text-green-800">Ready to Complete</p>
                <p className="text-sm text-green-600">
                  Photo {requiresSignature && '& signature'} captured
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-epyc-primary text-white rounded-lg font-medium flex items-center justify-center"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Complete Delivery'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
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
    if (!user) return;

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    // Log temperature
    await supabase.from('temperature_logs').insert({
      delivery_id: deliveryId,
      driver_id: driver?.id,
      temperature: temp,
      lat,
      lng,
    });

    // Also save as POD
    await supabase.from('proof_of_delivery').insert({
      delivery_id: deliveryId,
      type: 'temperature',
      temperature_reading: temp,
      lat,
      lng,
    });

    setSubmitting(false);
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
