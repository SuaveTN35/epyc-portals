import type { Delivery } from '@epyc/shared/types';
import type { BrokerAdapter, NormalizedBrokerJob } from './types';

interface GenericPayload {
  job_id: string;
  reference?: string;
  pickup: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
    contact_name?: string;
    contact_phone?: string;
    instructions?: string;
    window_start?: string;
    window_end?: string;
  };
  delivery: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
    contact_name?: string;
    contact_phone?: string;
    instructions?: string;
    window_start?: string;
    window_end?: string;
  };
  package?: {
    description?: string;
    weight?: number;
  };
  service_level?: string;
  vehicle_type?: string;
  requires_signature?: boolean;
  price?: number;
  payout?: number;
}

export class GenericAdapter implements BrokerAdapter {
  normalize(rawPayload: unknown): NormalizedBrokerJob {
    const payload = rawPayload as GenericPayload;

    if (!payload.job_id) {
      throw new Error('Missing required field: job_id');
    }
    if (!payload.pickup?.address || !payload.pickup?.city || !payload.pickup?.state || !payload.pickup?.zip) {
      throw new Error('Missing required pickup address fields');
    }
    if (!payload.delivery?.address || !payload.delivery?.city || !payload.delivery?.state || !payload.delivery?.zip) {
      throw new Error('Missing required delivery address fields');
    }

    const serviceLevel = this.mapServiceLevel(payload.service_level);
    const vehicleType = this.mapVehicleType(payload.vehicle_type);

    return {
      broker_job_id: payload.job_id,
      broker_reference: payload.reference,

      pickup_address: payload.pickup.address,
      pickup_city: payload.pickup.city,
      pickup_state: payload.pickup.state,
      pickup_zip: payload.pickup.zip,
      pickup_lat: payload.pickup.lat,
      pickup_lng: payload.pickup.lng,
      pickup_contact_name: payload.pickup.contact_name,
      pickup_contact_phone: payload.pickup.contact_phone,
      pickup_instructions: payload.pickup.instructions,
      pickup_window_start: payload.pickup.window_start,
      pickup_window_end: payload.pickup.window_end,

      delivery_address: payload.delivery.address,
      delivery_city: payload.delivery.city,
      delivery_state: payload.delivery.state,
      delivery_zip: payload.delivery.zip,
      delivery_lat: payload.delivery.lat,
      delivery_lng: payload.delivery.lng,
      delivery_contact_name: payload.delivery.contact_name,
      delivery_contact_phone: payload.delivery.contact_phone,
      delivery_instructions: payload.delivery.instructions,
      delivery_window_start: payload.delivery.window_start,
      delivery_window_end: payload.delivery.window_end,

      package_description: payload.package?.description,
      package_weight: payload.package?.weight,

      service_level: serviceLevel,
      vehicle_required: vehicleType,
      requires_signature: payload.requires_signature,

      broker_price: payload.price,
      broker_payout: payload.payout,
    };
  }

  formatStatusUpdate(delivery: Delivery, event: string): unknown {
    return {
      event,
      delivery_id: delivery.id,
      tracking_number: delivery.tracking_number,
      status: delivery.status,
      timestamp: new Date().toISOString(),
      driver_id: delivery.driver_id || undefined,
      actual_pickup_time: delivery.actual_pickup_time || undefined,
      actual_delivery_time: delivery.actual_delivery_time || undefined,
    };
  }

  private mapServiceLevel(level?: string): NormalizedBrokerJob['service_level'] {
    const mapping: Record<string, NormalizedBrokerJob['service_level']> = {
      standard: 'standard',
      priority: 'priority',
      express: 'priority',
      rush: 'rush',
      urgent: 'rush',
      scheduled: 'scheduled',
    };
    return mapping[level?.toLowerCase() || ''] || 'standard';
  }

  private mapVehicleType(type?: string): NormalizedBrokerJob['vehicle_required'] {
    if (!type) return undefined;
    const mapping: Record<string, NormalizedBrokerJob['vehicle_required']> = {
      car: 'car',
      sedan: 'car',
      suv: 'suv',
      van: 'van',
      truck: 'truck',
      box_truck: 'box_truck',
      boxtruck: 'box_truck',
    };
    return mapping[type.toLowerCase()] || undefined;
  }
}
