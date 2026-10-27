'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  User,
  Truck,
  Phone,
  Mail,
  DollarSign,
  FileText,
  Thermometer,
  CheckCircle,
  AlertCircle,
  XCircle,
  Camera,
  PenTool,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { formatCurrency } from '@epyc/shared/utils';
import {
  ASSIGNABLE_STATUSES,
  CANCELLABLE_STATUSES,
  deliveryStatusBadge,
  deliveryStatusLabel,
} from '@/lib/delivery-status';
import { jobSourceLabel } from '@/lib/new-job';
import { OfferJobDialog } from '@/components/dispatch/OfferJobDialog';

interface DeliveryDetail {
  id: string;
  tracking_number: string;
  status: string;
  service_level: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions: string | null;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  delivery_instructions: string | null;
  package_description: string | null;
  package_weight: number | null;
  total_price: number | null;
  distance_miles: number | null;
  source?: string | null;
  source_reference?: string | null;
  driver_payout: number | null;
  requires_signature: boolean;
  is_fragile: boolean;
  is_hipaa: boolean;
  requires_temperature_control: boolean;
  temperature_min: number | null;
  temperature_max: number | null;
  created_at: string;
  assigned_at: string | null;
  actual_pickup_time: string | null;
  actual_delivery_time: string | null;
  pickup_window_start: string | null;
  driver: {
    id: string;
    full_name: string;
    phone: string;
    vehicle_type: string;
  } | null;
  customer: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  } | null;
}

interface JobOfferSummary {
  id: string;
  status: string;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  driver_name: string;
}

interface DeliveryEvent {
  id: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

interface TemperatureLog {
  id: string;
  temperature: number;
  recorded_at: string;
}

// proof_of_delivery stores one row per capture type (photo, signature, ...).
// This is the merged view dispatch shows.
interface ProofOfDelivery {
  photo_signed_url: string | null;
  signature_data: string | null;
  recipient_name: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  captured_at: string | null;
}

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [temperatureLogs, setTemperatureLogs] = useState<TemperatureLog[]>([]);
  const [pod, setPod] = useState<ProofOfDelivery | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [offers, setOffers] = useState<JobOfferSummary[]>([]);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerNotice, setOfferNotice] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchDeliveryDetails();
    }
  }, [params.id]);

  // Arriving from the New Job form (?created=1): confirm the save once.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setJustCreated(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const fetchDeliveryDetails = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch delivery details
    const { data: deliveryData } = await supabase
      .from('deliveries')
      .select(`
        *,
        driver:drivers!driver_id(
          id,
          vehicle_type,
          profiles(full_name, phone)
        ),
        customer:profiles!customer_id(
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq('id', params.id)
      .single();

    if (deliveryData) {
      setDelivery({
        ...deliveryData,
        driver: deliveryData.driver
          ? {
              id: deliveryData.driver.id,
              full_name: deliveryData.driver.profiles?.full_name || 'Unknown',
              phone: deliveryData.driver.profiles?.phone || '',
              vehicle_type: deliveryData.driver.vehicle_type,
            }
          : null,
        customer: deliveryData.customer
          ? {
              id: deliveryData.customer.id,
              full_name: deliveryData.customer.full_name || 'Unknown',
              email: deliveryData.customer.email || '',
              phone: deliveryData.customer.phone || '',
            }
          : null,
      });
    }

    // Fetch job offers for this delivery (staff select policy, Phase 1)
    const { data: offerRows } = await supabase
      .from('job_offers')
      .select('id, status, expires_at, responded_at, created_at, driver:drivers(profiles(full_name))')
      .eq('delivery_id', params.id)
      .order('created_at', { ascending: false });

    setOffers(
      (offerRows || []).map((o: any) => ({
        id: o.id,
        status: o.status,
        expires_at: o.expires_at,
        responded_at: o.responded_at,
        created_at: o.created_at,
        driver_name: o.driver?.profiles?.full_name || 'Unknown',
      }))
    );

    // Fetch delivery events
    const { data: eventsData } = await supabase
      .from('delivery_events')
      .select('*')
      .eq('delivery_id', params.id)
      .order('created_at', { ascending: false });

    if (eventsData) {
      setEvents(eventsData);
    }

    // Fetch temperature logs
    const { data: tempData } = await supabase
      .from('temperature_logs')
      .select('*')
      .eq('delivery_id', params.id)
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (tempData) {
      setTemperatureLogs(tempData);
    }

    // Fetch proof of delivery (one row per capture type)
    const { data: podRows } = await supabase
      .from('proof_of_delivery')
      .select('type, photo_url, signature_data, recipient_name, notes, lat, lng, captured_at')
      .eq('delivery_id', params.id)
      .order('captured_at', { ascending: true });

    if (podRows && podRows.length > 0) {
      const photoRow = podRows.find((r: any) => r.type === 'photo' && r.photo_url);
      const sigRow = podRows.find((r: any) => r.type === 'signature' && r.signature_data);
      const withName = podRows.find((r: any) => r.recipient_name);
      const withNotes = podRows.find((r: any) => r.notes);
      const withGps = podRows.find((r: any) => r.lat != null && r.lng != null);

      // photo_url holds a path in the private delivery-photos bucket.
      let photoSignedUrl: string | null = null;
      if (photoRow?.photo_url) {
        if (/^https?:\/\//.test(photoRow.photo_url)) {
          photoSignedUrl = photoRow.photo_url;
        } else {
          const { data: signed } = await supabase.storage
            .from('delivery-photos')
            .createSignedUrl(photoRow.photo_url, 300);
          photoSignedUrl = signed?.signedUrl ?? null;
        }
      }

      setPod({
        photo_signed_url: photoSignedUrl,
        signature_data: sigRow?.signature_data ?? null,
        recipient_name: withName?.recipient_name ?? null,
        notes: withNotes?.notes ?? null,
        lat: withGps?.lat ?? null,
        lng: withGps?.lng ?? null,
        captured_at: podRows[podRows.length - 1].captured_at ?? null,
      });
    } else {
      setPod(null);
    }

    setLoading(false);
  };

  const handleCancelDelivery = async () => {
    if (!delivery || !confirm('Are you sure you want to cancel this delivery?')) return;

    setCancelling(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    // The status-change trigger logs the transition; this event adds who did it.
    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'cancelled' })
      .eq('id', delivery.id);

    if (error) {
      alert(`Could not cancel: ${error.message}`);
    } else {
      // Close any open offers so no driver can accept a cancelled job.
      await supabase
        .from('job_offers')
        .update({ status: 'expired' })
        .eq('delivery_id', delivery.id)
        .eq('status', 'pending');

      if (delivery.driver) {
        await supabase
          .from('drivers')
          .update({ current_delivery_id: null })
          .eq('id', delivery.driver.id)
          .eq('current_delivery_id', delivery.id);
      }
      await supabase.from('delivery_events').insert({
        delivery_id: delivery.id,
        event_type: 'cancelled_by_dispatch',
        old_status: delivery.status,
        new_status: 'cancelled',
        notes: 'Delivery cancelled by dispatcher',
        created_by: user?.id ?? null,
      });

      fetchDeliveryDetails();
    }

    setCancelling(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">Delivery not found</p>
        <Link
          href="/dispatch/deliveries"
          className="mt-4 inline-flex items-center text-epyc-primary hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Deliveries
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dispatch/deliveries"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {delivery.tracking_number}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`status-badge border ${deliveryStatusBadge(delivery.status)}`}
              >
                {deliveryStatusLabel(delivery.status)}
              </span>
              <span className="text-sm text-gray-500 capitalize">
                {(delivery.service_level || 'standard').replace('_', ' ')} Service
              </span>
              <span className="text-sm text-gray-500">
                {jobSourceLabel(delivery.source)}
                {delivery.source_reference ? ` #${delivery.source_reference}` : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {delivery.status === 'booked' && !delivery.driver && (
            <button
              onClick={() => {
                setOfferNotice(null);
                setShowOfferDialog(true);
              }}
              className="px-4 py-2 border border-epyc-primary text-epyc-primary rounded-lg hover:bg-blue-50"
            >
              Offer to Drivers
            </button>
          )}
          {ASSIGNABLE_STATUSES.includes(delivery.status as any) && (
            <Link
              href={`/dispatch/deliveries?assign=${delivery.id}`}
              className="px-4 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700"
            >
              {delivery.driver ? 'Reassign Driver' : 'Assign Driver'}
            </Link>
          )}
          {CANCELLABLE_STATUSES.includes(delivery.status as any) && (
            <button
              onClick={handleCancelDelivery}
              disabled={cancelling}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Delivery'}
            </button>
          )}
        </div>
      </div>

      {showOfferDialog && (
        <OfferJobDialog
          delivery={{
            id: delivery.id,
            driver_payout: delivery.driver_payout,
            pickup_lat: delivery.pickup_lat ?? null,
            pickup_lng: delivery.pickup_lng ?? null,
          }}
          onClose={() => setShowOfferDialog(false)}
          onSent={(count) => {
            setShowOfferDialog(false);
            setOfferNotice(`Offer sent to ${count} driver${count === 1 ? '' : 's'}.`);
            fetchDeliveryDetails();
          }}
        />
      )}

      {offerNotice && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          {offerNotice}
        </div>
      )}

      {justCreated && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center text-sm text-green-800">
          <CheckCircle className="h-5 w-5 mr-3 text-green-600" />
          Job saved as {delivery.tracking_number}. Assign a driver or offer it to drivers now.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Route card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Route Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pickup */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-900">Pickup</span>
                </div>
                <div className="ml-10 space-y-2">
                  <p className="text-sm text-gray-700">{delivery.pickup_address}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    {delivery.pickup_contact_name}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    {delivery.pickup_contact_phone}
                  </div>
                  {delivery.pickup_instructions && (
                    <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                      {delivery.pickup_instructions}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="font-medium text-gray-900">Delivery</span>
                </div>
                <div className="ml-10 space-y-2">
                  <p className="text-sm text-gray-700">{delivery.delivery_address}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    {delivery.delivery_contact_name}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    {delivery.delivery_contact_phone}
                  </div>
                  {delivery.delivery_instructions && (
                    <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                      {delivery.delivery_instructions}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Package details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Package Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium">{delivery.package_description || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Weight</p>
                <p className="font-medium">
                  {delivery.package_weight != null ? `${delivery.package_weight} lbs` : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Distance</p>
                <p className="font-medium">
                  {delivery.distance_miles != null
                    ? `${Number(delivery.distance_miles).toFixed(1)} miles`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Requirements</p>
                <div className="flex flex-wrap gap-1">
                  {delivery.is_hipaa && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                      HIPAA
                    </span>
                  )}
                  {delivery.is_fragile && (
                    <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                      Fragile
                    </span>
                  )}
                  {delivery.requires_signature && (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                      Signature
                    </span>
                  )}
                  {delivery.requires_temperature_control && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                      Temp Control
                    </span>
                  )}
                </div>
              </div>
            </div>

            {delivery.requires_temperature_control && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Temperature Requirements</span>
                </div>
                <p className="text-sm text-blue-800">
                  {delivery.temperature_min}°F - {delivery.temperature_max}°F
                </p>
                {temperatureLogs.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-blue-700">
                      Latest reading: {temperatureLogs[0].temperature}°F at{' '}
                      {new Date(temperatureLogs[0].recorded_at).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Proof of Delivery */}
          {pod && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pod.photo_signed_url && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Photo</p>
                    <img
                      src={pod.photo_signed_url}
                      alt="Delivery photo"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
                {pod.signature_data && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Signature</p>
                    <img
                      src={pod.signature_data}
                      alt="Recipient signature"
                      className="w-full h-48 object-contain bg-gray-50 rounded-lg"
                    />
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">Received by</p>
                <p className="font-medium">{pod.recipient_name || 'Not recorded'}</p>
                {pod.notes && (
                  <p className="text-sm text-gray-600 mt-1">{pod.notes}</p>
                )}
                {pod.lat != null && pod.lng != null && (
                  <p className="text-xs text-gray-500 mt-1">
                    GPS {pod.lat.toFixed(5)}, {pod.lng.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-epyc-primary rounded-full flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    {index < events.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-gray-900 capitalize">
                      {event.event_type.replace(/_/g, ' ')}
                    </p>
                    {event.new_status && (
                      <p className="text-sm text-gray-600">
                        {event.old_status ? `${deliveryStatusLabel(event.old_status)} -> ` : ''}
                        {deliveryStatusLabel(event.new_status)}
                      </p>
                    )}
                    {event.notes && <p className="text-sm text-gray-600">{event.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                    {event.lat != null && event.lng != null && (
                      <p className="text-xs text-gray-500">
                        {event.lat.toFixed(5)}, {event.lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-gray-500 text-sm">No events recorded yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-semibold">
                  {formatCurrency(delivery.total_price || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Driver Payout</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(delivery.driver_payout || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Platform Fee</span>
                <span className="text-gray-500">
                  {formatCurrency((delivery.total_price || 0) - (delivery.driver_payout || 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Driver info */}
          {delivery.driver && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Driver</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-epyc-primary rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-white">
                    {delivery.driver.full_name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{delivery.driver.full_name}</p>
                  <p className="text-sm text-gray-500 capitalize">
                    {delivery.driver.vehicle_type.replace('_', ' ')}
                  </p>
                </div>
              </div>
              {delivery.driver.phone && (
                <a
                  href={`tel:${delivery.driver.phone}`}
                  className="flex items-center gap-2 text-sm text-epyc-primary hover:text-blue-700"
                >
                  <Phone className="h-4 w-4" />
                  {delivery.driver.phone}
                </a>
              )}
              <Link
                href={`/dispatch/drivers/${delivery.driver.id}`}
                className="mt-3 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                View Profile
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </div>
          )}

          {/* Customer info */}
          {delivery.customer && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span>{delivery.customer.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a
                    href={`mailto:${delivery.customer.email}`}
                    className="text-epyc-primary hover:text-blue-700"
                  >
                    {delivery.customer.email}
                  </a>
                </div>
                {delivery.customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a
                      href={`tel:${delivery.customer.phone}`}
                      className="text-epyc-primary hover:text-blue-700"
                    >
                      {delivery.customer.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job offers */}
          {offers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Offers</h2>
              <ul className="space-y-2 text-sm">
                {offers.map((o) => {
                  const expired =
                    o.status === 'pending' && new Date(o.expires_at).getTime() <= Date.now();
                  const label = expired ? 'expired' : o.status;
                  return (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span className="text-gray-700">{o.driver_name}</span>
                      <span
                        className={`capitalize ${
                          label === 'accepted'
                            ? 'text-green-600'
                            : label === 'pending'
                              ? 'text-blue-600'
                              : 'text-gray-500'
                        }`}
                      >
                        {label === 'rejected' ? 'declined' : label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timestamps</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span>{new Date(delivery.created_at).toLocaleString()}</span>
              </div>
              {delivery.pickup_window_start && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Scheduled</span>
                  <span>{new Date(delivery.pickup_window_start).toLocaleString()}</span>
                </div>
              )}
              {delivery.assigned_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned</span>
                  <span>{new Date(delivery.assigned_at).toLocaleString()}</span>
                </div>
              )}
              {delivery.actual_pickup_time && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Picked Up</span>
                  <span>{new Date(delivery.actual_pickup_time).toLocaleString()}</span>
                </div>
              )}
              {delivery.actual_delivery_time && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivered</span>
                  <span>{new Date(delivery.actual_delivery_time).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
