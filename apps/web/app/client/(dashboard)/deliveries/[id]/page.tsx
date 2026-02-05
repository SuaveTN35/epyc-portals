import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Shield,
  Thermometer,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline';
import { RouteCard } from '@/components/delivery/RouteCard';
import { DriverCard } from '@/components/delivery/DriverCard';
import { ProofOfDeliveryDisplay } from '@/components/delivery/ProofOfDeliveryDisplay';
import { DeliveryEventsList } from '@/components/delivery/DeliveryEventsList';
import {
  DELIVERY_STATUS_CONFIG,
  VEHICLE_CONFIG,
  SERVICE_LEVEL_CONFIG,
  formatCurrency,
} from '@epyc/shared';
import type { DeliveryStatus, VehicleType, ServiceLevel } from '@epyc/shared';
import { CancelDeliveryButton } from './CancelDeliveryButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getDelivery(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get delivery with driver info
  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select(
      `
      *,
      driver:drivers(
        id,
        user_id,
        vehicle_type,
        vehicle_make,
        vehicle_model,
        vehicle_color,
        license_plate,
        rating,
        total_deliveries,
        profiles:user_id(full_name, phone, avatar_url)
      )
    `
    )
    .eq('id', id)
    .eq('customer_id', user.id)
    .single();

  if (error || !delivery) return null;

  // Get proof of delivery if delivered
  let proofOfDelivery = null;
  if (delivery.status === 'delivered') {
    const { data: pod } = await supabase
      .from('proof_of_delivery')
      .select('*')
      .eq('delivery_id', id)
      .single();
    proofOfDelivery = pod;
  }

  // Get delivery events
  const { data: events } = await supabase
    .from('delivery_events')
    .select('*')
    .eq('delivery_id', id)
    .order('created_at', { ascending: false });

  return {
    delivery,
    proofOfDelivery,
    events: events || [],
  };
}

export default async function DeliveryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getDelivery(id);

  if (!data) {
    notFound();
  }

  const { delivery, proofOfDelivery, events } = data;
  const statusConfig = DELIVERY_STATUS_CONFIG[delivery.status as DeliveryStatus];
  const vehicleConfig = delivery.vehicle_required
    ? VEHICLE_CONFIG[delivery.vehicle_required as VehicleType]
    : null;
  const serviceConfig = delivery.service_level
    ? SERVICE_LEVEL_CONFIG[delivery.service_level as ServiceLevel]
    : null;

  // Format driver info if available
  const driverInfo = delivery.driver
    ? {
        id: delivery.driver.id,
        full_name: delivery.driver.profiles?.full_name || 'Unknown Driver',
        phone: delivery.driver.profiles?.phone,
        avatar_url: delivery.driver.profiles?.avatar_url,
        vehicle_type: delivery.driver.vehicle_type,
        vehicle_make: delivery.driver.vehicle_make,
        vehicle_model: delivery.driver.vehicle_model,
        vehicle_color: delivery.driver.vehicle_color,
        license_plate: delivery.driver.license_plate,
        rating: delivery.driver.rating,
        total_deliveries: delivery.driver.total_deliveries,
      }
    : null;

  const canCancel = ['booked', 'assigned'].includes(delivery.status);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/client/deliveries"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Deliveries
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {delivery.tracking_number}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-gray-500 mt-1">
              Created {new Date(delivery.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Track Link */}
            <Link
              href={`/track?tracking=${delivery.tracking_number}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Track Publicly
            </Link>

            {/* Cancel Button */}
            {canCancel && <CancelDeliveryButton deliveryId={delivery.id} />}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Route Card */}
          <RouteCard
            pickup={{
              type: 'pickup',
              address: delivery.pickup_address,
              city: delivery.pickup_city,
              state: delivery.pickup_state,
              zip: delivery.pickup_zip,
              contactName: delivery.pickup_contact_name,
              contactPhone: delivery.pickup_contact_phone,
              instructions: delivery.pickup_instructions,
            }}
            delivery={{
              type: 'delivery',
              address: delivery.delivery_address,
              city: delivery.delivery_city,
              state: delivery.delivery_state,
              zip: delivery.delivery_zip,
              contactName: delivery.delivery_contact_name,
              contactPhone: delivery.delivery_contact_phone,
              instructions: delivery.delivery_instructions,
            }}
            distanceMiles={delivery.distance_miles}
            estimatedMinutes={delivery.estimated_duration_minutes}
          />

          {/* Package Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Details</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium text-gray-900">
                  {delivery.package_description || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Weight</p>
                <p className="font-medium text-gray-900">
                  {delivery.package_weight ? `${delivery.package_weight} lbs` : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Dimensions</p>
                <p className="font-medium text-gray-900">
                  {delivery.package_length && delivery.package_width && delivery.package_height
                    ? `${delivery.package_length}" × ${delivery.package_width}" × ${delivery.package_height}"`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vehicle</p>
                <p className="font-medium text-gray-900">
                  {vehicleConfig
                    ? `${vehicleConfig.icon} ${vehicleConfig.label}`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Special Requirements */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
              {delivery.requires_signature && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  <Package className="h-3 w-3 mr-1" />
                  Signature Required
                </span>
              )}
              {delivery.is_fragile && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Fragile
                </span>
              )}
              {delivery.is_medical && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <Shield className="h-3 w-3 mr-1" />
                  Medical
                </span>
              )}
              {delivery.is_hipaa && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <Shield className="h-3 w-3 mr-1" />
                  HIPAA
                </span>
              )}
              {delivery.requires_temperature_control && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
                  <Thermometer className="h-3 w-3 mr-1" />
                  {delivery.temperature_min}°C - {delivery.temperature_max}°C
                </span>
              )}
            </div>
          </div>

          {/* Proof of Delivery */}
          {delivery.status === 'delivered' && (
            <ProofOfDeliveryDisplay
              pod={proofOfDelivery}
              requiresSignature={delivery.requires_signature}
            />
          )}

          {/* Activity Log */}
          <DeliveryEventsList events={events} />
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <DeliveryStatusTimeline
            currentStatus={delivery.status as DeliveryStatus}
            timestamps={{
              booked_at: delivery.booked_at,
              assigned_at: delivery.assigned_at,
              pickup_started_at: delivery.pickup_started_at,
              picked_up_at: delivery.picked_up_at,
              delivery_started_at: delivery.delivery_started_at,
              delivered_at: delivery.delivered_at,
            }}
          />

          {/* Driver Card */}
          <DriverCard driver={driverInfo} status={delivery.status} />

          {/* Pricing */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Service Level</span>
                <span className="font-medium">
                  {serviceConfig?.label || delivery.service_level}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Base Rate</span>
                <span>{formatCurrency(delivery.base_price || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Distance ({delivery.distance_miles?.toFixed(1)} mi)
                </span>
                <span>{formatCurrency(delivery.distance_price || 0)}</span>
              </div>
              {delivery.weight_surcharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Weight Surcharge</span>
                  <span>{formatCurrency(delivery.weight_surcharge)}</span>
                </div>
              )}
              {delivery.hipaa_surcharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">HIPAA Compliance</span>
                  <span>{formatCurrency(delivery.hipaa_surcharge)}</span>
                </div>
              )}
              {delivery.temperature_surcharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Temperature Control</span>
                  <span>{formatCurrency(delivery.temperature_surcharge)}</span>
                </div>
              )}
              {delivery.rush_surcharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Rush Service</span>
                  <span>{formatCurrency(delivery.rush_surcharge)}</span>
                </div>
              )}

              <hr className="my-2" />

              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-epyc-primary">
                  {formatCurrency(delivery.total_price || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
