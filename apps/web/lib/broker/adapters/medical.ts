import type { Delivery } from '@epyc/shared/types';
import type { BrokerAdapter, NormalizedBrokerJob } from './types';

interface MedicalPayload {
  order_id: string;
  reference_number?: string;
  patient_id?: string;
  origin: {
    facility_name?: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
    contact_name?: string;
    contact_phone?: string;
    instructions?: string;
    ready_time?: string;
    close_time?: string;
  };
  destination: {
    facility_name?: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
    contact_name?: string;
    contact_phone?: string;
    instructions?: string;
    delivery_by?: string;
  };
  specimen?: {
    type?: string;
    description?: string;
    weight_lbs?: number;
    temperature_sensitive?: boolean;
    temp_min_f?: number;
    temp_max_f?: number;
  };
  hipaa_required?: boolean;
  priority?: string;
  price?: number;
  driver_pay?: number;
}

export class MedicalAdapter implements BrokerAdapter {
  normalize(rawPayload: unknown): NormalizedBrokerJob {
    const payload = rawPayload as MedicalPayload;

    if (!payload.order_id) {
      throw new Error('Missing required field: order_id');
    }
    if (!payload.origin?.address || !payload.origin?.city || !payload.origin?.state || !payload.origin?.zip) {
      throw new Error('Missing required origin address fields');
    }
    if (!payload.destination?.address || !payload.destination?.city || !payload.destination?.state || !payload.destination?.zip) {
      throw new Error('Missing required destination address fields');
    }

    const pickupInstructions = [
      payload.origin.instructions,
      payload.origin.facility_name ? `Facility: ${payload.origin.facility_name}` : null,
    ].filter(Boolean).join('. ');

    const deliveryInstructions = [
      payload.destination.instructions,
      payload.destination.facility_name ? `Facility: ${payload.destination.facility_name}` : null,
    ].filter(Boolean).join('. ');

    const packageDesc = [
      payload.specimen?.type ? `Specimen: ${payload.specimen.type}` : null,
      payload.specimen?.description,
    ].filter(Boolean).join(' - ') || 'Medical specimen/supplies';

    return {
      broker_job_id: payload.order_id,
      broker_reference: payload.reference_number,

      pickup_address: payload.origin.address,
      pickup_city: payload.origin.city,
      pickup_state: payload.origin.state,
      pickup_zip: payload.origin.zip,
      pickup_lat: payload.origin.lat,
      pickup_lng: payload.origin.lng,
      pickup_contact_name: payload.origin.contact_name,
      pickup_contact_phone: payload.origin.contact_phone,
      pickup_instructions: pickupInstructions || undefined,
      pickup_window_start: payload.origin.ready_time,
      pickup_window_end: payload.origin.close_time,

      delivery_address: payload.destination.address,
      delivery_city: payload.destination.city,
      delivery_state: payload.destination.state,
      delivery_zip: payload.destination.zip,
      delivery_lat: payload.destination.lat,
      delivery_lng: payload.destination.lng,
      delivery_contact_name: payload.destination.contact_name,
      delivery_contact_phone: payload.destination.contact_phone,
      delivery_instructions: deliveryInstructions || undefined,
      delivery_window_end: payload.destination.delivery_by,

      package_description: packageDesc,
      package_weight: payload.specimen?.weight_lbs,

      service_level: this.mapPriority(payload.priority),
      is_medical: true,
      is_hipaa: payload.hipaa_required !== false, // Default true for medical
      requires_signature: true, // Always require for medical
      requires_temperature_control: payload.specimen?.temperature_sensitive || false,
      temperature_min: payload.specimen?.temp_min_f,
      temperature_max: payload.specimen?.temp_max_f,

      broker_price: payload.price,
      broker_payout: payload.driver_pay,
    };
  }

  formatStatusUpdate(delivery: Delivery, event: string): unknown {
    return {
      event,
      order_id: delivery.id,
      tracking_number: delivery.tracking_number,
      status: this.mapStatusToMedical(delivery.status),
      timestamp: new Date().toISOString(),
      driver_id: delivery.driver_id || undefined,
      pickup_time: delivery.actual_pickup_time || undefined,
      delivery_time: delivery.actual_delivery_time || undefined,
      chain_of_custody: {
        picked_up: !!delivery.actual_pickup_time,
        delivered: delivery.status === 'delivered',
        signature_captured: delivery.requires_signature && delivery.status === 'delivered',
      },
    };
  }

  private mapPriority(priority?: string): NormalizedBrokerJob['service_level'] {
    const mapping: Record<string, NormalizedBrokerJob['service_level']> = {
      routine: 'standard',
      stat: 'rush',
      urgent: 'rush',
      priority: 'priority',
      timed: 'scheduled',
      scheduled: 'scheduled',
    };
    return mapping[priority?.toLowerCase() || ''] || 'priority';
  }

  private mapStatusToMedical(status: string): string {
    const mapping: Record<string, string> = {
      booked: 'received',
      assigned: 'dispatched',
      en_route_pickup: 'en_route_origin',
      arrived_pickup: 'at_origin',
      picked_up: 'specimen_collected',
      en_route_delivery: 'in_transit',
      arrived_delivery: 'at_destination',
      delivered: 'delivered',
      cancelled: 'cancelled',
      failed: 'failed',
    };
    return mapping[status] || status;
  }
}
