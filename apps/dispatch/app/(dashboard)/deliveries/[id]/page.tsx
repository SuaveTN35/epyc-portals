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
  package_description: string;
  package_weight: number;
  total_amount: number;
  distance_miles: number;
  driver_payout: number;
  requires_signature: boolean;
  is_fragile: boolean;
  is_hipaa: boolean;
  requires_temperature_control: boolean;
  min_temperature: number | null;
  max_temperature: number | null;
  created_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  scheduled_pickup: string | null;
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

interface DeliveryEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  location: string | null;
}

interface TemperatureLog {
  id: string;
  temperature: number;
  recorded_at: string;
}

interface ProofOfDelivery {
  id: string;
  photo_url: string;
  signature_url: string | null;
  recipient_name: string;
  notes: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  assigned: 'bg-blue-100 text-blue-800 border-blue-300',
  picked_up: 'bg-purple-100 text-purple-800 border-purple-300',
  in_transit: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  delivered: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [temperatureLogs, setTemperatureLogs] = useState<TemperatureLog[]>([]);
  const [pod, setPod] = useState<ProofOfDelivery | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDeliveryDetails();
    }
  }, [params.id]);

  const fetchDeliveryDetails = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch delivery details
    const { data: deliveryData } = await supabase
      .from('deliveries')
      .select(`
        *,
        driver:drivers(
          id,
          vehicle_type,
          profiles(full_name, phone)
        ),
        customer:profiles!deliveries_customer_id_fkey(
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

    // Fetch proof of delivery
    const { data: podData } = await supabase
      .from('proof_of_delivery')
      .select('*')
      .eq('delivery_id', params.id)
      .single();

    if (podData) {
      setPod(podData);
    }

    setLoading(false);
  };

  const handleCancelDelivery = async () => {
    if (!delivery || !confirm('Are you sure you want to cancel this delivery?')) return;

    setCancelling(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'cancelled' })
      .eq('id', delivery.id);

    if (!error) {
      await supabase.from('delivery_events').insert({
        delivery_id: delivery.id,
        event_type: 'cancelled',
        description: 'Delivery cancelled by dispatcher',
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
          href="/deliveries"
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
            href="/deliveries"
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
                className={`status-badge border ${statusColors[delivery.status]}`}
              >
                {delivery.status.replace('_', ' ')}
              </span>
              <span className="text-sm text-gray-500 capitalize">
                {delivery.service_level.replace('_', ' ')} Service
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {delivery.status === 'pending' && (
            <Link
              href={`/deliveries?assign=${delivery.id}`}
              className="px-4 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700"
            >
              Assign Driver
            </Link>
          )}
          {!['delivered', 'cancelled'].includes(delivery.status) && (
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
                <p className="font-medium">{delivery.package_description}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Weight</p>
                <p className="font-medium">{delivery.package_weight} lbs</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Distance</p>
                <p className="font-medium">{delivery.distance_miles.toFixed(1)} miles</p>
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
                  {delivery.min_temperature}°F - {delivery.max_temperature}°F
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
                {pod.photo_url && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Photo</p>
                    <img
                      src={pod.photo_url}
                      alt="Delivery photo"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
                {pod.signature_url && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Signature</p>
                    <img
                      src={pod.signature_url}
                      alt="Recipient signature"
                      className="w-full h-48 object-contain bg-gray-50 rounded-lg"
                    />
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">Received by</p>
                <p className="font-medium">{pod.recipient_name}</p>
                {pod.notes && (
                  <p className="text-sm text-gray-600 mt-1">{pod.notes}</p>
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
                      {event.event_type.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-600">{event.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-500">{event.location}</p>
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
                  {formatCurrency(delivery.total_amount / 100)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Driver Payout</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(delivery.driver_payout / 100)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Platform Fee</span>
                <span className="text-gray-500">
                  {formatCurrency((delivery.total_amount - delivery.driver_payout) / 100)}
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
                href={`/drivers/${delivery.driver.id}`}
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

          {/* Timestamps */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timestamps</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span>{new Date(delivery.created_at).toLocaleString()}</span>
              </div>
              {delivery.scheduled_pickup && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Scheduled</span>
                  <span>{new Date(delivery.scheduled_pickup).toLocaleString()}</span>
                </div>
              )}
              {delivery.assigned_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned</span>
                  <span>{new Date(delivery.assigned_at).toLocaleString()}</span>
                </div>
              )}
              {delivery.picked_up_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Picked Up</span>
                  <span>{new Date(delivery.picked_up_at).toLocaleString()}</span>
                </div>
              )}
              {delivery.delivered_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivered</span>
                  <span>{new Date(delivery.delivered_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
