import type { Delivery } from '@epyc/shared/types';
import type { BrokerAdapter, NormalizedBrokerJob } from './types';

interface LogisticsPayload {
  load_id: string;
  reference?: string;
  shipper: {
    name?: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
    contact?: string;
    phone?: string;
    notes?: string;
    pickup_date?: string;
    pickup_time_from?: string;
    pickup_time_to?: string;
  };
  consignee: {
    name?: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
    contact?: string;
    phone?: string;
    notes?: string;
    delivery_date?: string;
    delivery_time_from?: string;
    delivery_time_to?: string;
  };
  cargo?: {
    description?: string;
    weight_lbs?: number;
    pieces?: number;
    dims?: string;
  };
  equipment_type?: string;
  service_type?: string;
  rate?: number;
  carrier_pay?: number;
  require_pod?: boolean;
}

export class LogisticsAdapter implements BrokerAdapter {
  normalize(rawPayload: unknown): NormalizedBrokerJob {
    const payload = rawPayload as LogisticsPayload;

    if (!payload.load_id) {
      throw new Error('Missing required field: load_id');
    }
    if (!payload.shipper?.address || !payload.shipper?.city || !payload.shipper?.state || !payload.shipper?.zip) {
      throw new Error('Missing required shipper address fields');
    }
    if (!payload.consignee?.address || !payload.consignee?.city || !payload.consignee?.state || !payload.consignee?.zip) {
      throw new Error('Missing required consignee address fields');
    }

    const pickupWindowStart = this.buildTimestamp(
      payload.shipper.pickup_date,
      payload.shipper.pickup_time_from
    );
    const pickupWindowEnd = this.buildTimestamp(
      payload.shipper.pickup_date,
      payload.shipper.pickup_time_to
    );
    const deliveryWindowStart = this.buildTimestamp(
      payload.consignee.delivery_date,
      payload.consignee.delivery_time_from
    );
    const deliveryWindowEnd = this.buildTimestamp(
      payload.consignee.delivery_date,
      payload.consignee.delivery_time_to
    );

    const packageDesc = [
      payload.cargo?.description,
      payload.cargo?.pieces ? `${payload.cargo.pieces} pcs` : null,
      payload.cargo?.dims ? `Dims: ${payload.cargo.dims}` : null,
    ].filter(Boolean).join(', ') || undefined;

    return {
      broker_job_id: payload.load_id,
      broker_reference: payload.reference,

      pickup_address: payload.shipper.address,
      pickup_city: payload.shipper.city,
      pickup_state: payload.shipper.state,
      pickup_zip: payload.shipper.zip,
      pickup_lat: payload.shipper.lat,
      pickup_lng: payload.shipper.lng,
      pickup_contact_name: payload.shipper.contact || payload.shipper.name,
      pickup_contact_phone: payload.shipper.phone,
      pickup_instructions: payload.shipper.notes,
      pickup_window_start: pickupWindowStart,
      pickup_window_end: pickupWindowEnd,

      delivery_address: payload.consignee.address,
      delivery_city: payload.consignee.city,
      delivery_state: payload.consignee.state,
      delivery_zip: payload.consignee.zip,
      delivery_lat: payload.consignee.lat,
      delivery_lng: payload.consignee.lng,
      delivery_contact_name: payload.consignee.contact || payload.consignee.name,
      delivery_contact_phone: payload.consignee.phone,
      delivery_instructions: payload.consignee.notes,
      delivery_window_start: deliveryWindowStart,
      delivery_window_end: deliveryWindowEnd,

      package_description: packageDesc,
      package_weight: payload.cargo?.weight_lbs,

      service_level: this.mapServiceType(payload.service_type),
      vehicle_required: this.mapEquipmentType(payload.equipment_type),
      requires_signature: payload.require_pod !== false,

      broker_price: payload.rate,
      broker_payout: payload.carrier_pay,
    };
  }

  formatStatusUpdate(delivery: Delivery, event: string): unknown {
    return {
      event,
      load_id: delivery.id,
      tracking_number: delivery.tracking_number,
      status: this.mapStatusToLogistics(delivery.status),
      timestamp: new Date().toISOString(),
      carrier_driver_id: delivery.driver_id || undefined,
      pickup_time: delivery.actual_pickup_time || undefined,
      delivery_time: delivery.actual_delivery_time || undefined,
    };
  }

  private buildTimestamp(date?: string, time?: string): string | undefined {
    if (!date) return undefined;
    if (time) return `${date}T${time}`;
    return date;
  }

  private mapServiceType(type?: string): NormalizedBrokerJob['service_level'] {
    const mapping: Record<string, NormalizedBrokerJob['service_level']> = {
      ltl: 'standard',
      standard: 'standard',
      expedited: 'priority',
      priority: 'priority',
      hot_shot: 'rush',
      hotshot: 'rush',
      rush: 'rush',
      same_day: 'rush',
      scheduled: 'scheduled',
    };
    return mapping[type?.toLowerCase() || ''] || 'standard';
  }

  private mapEquipmentType(type?: string): NormalizedBrokerJob['vehicle_required'] {
    if (!type) return undefined;
    const mapping: Record<string, NormalizedBrokerJob['vehicle_required']> = {
      car: 'car',
      sedan: 'car',
      suv: 'suv',
      cargo_van: 'van',
      sprinter: 'van',
      van: 'van',
      straight_truck: 'truck',
      pickup: 'truck',
      box_truck: 'box_truck',
      cube: 'box_truck',
    };
    return mapping[type.toLowerCase()] || undefined;
  }

  private mapStatusToLogistics(status: string): string {
    const mapping: Record<string, string> = {
      booked: 'tendered',
      assigned: 'accepted',
      en_route_pickup: 'en_route_shipper',
      arrived_pickup: 'at_shipper',
      picked_up: 'loaded',
      en_route_delivery: 'in_transit',
      arrived_delivery: 'at_consignee',
      delivered: 'delivered',
      cancelled: 'cancelled',
      failed: 'exception',
    };
    return mapping[status] || status;
  }
}
