import type { ServiceLevel, VehicleType, Delivery } from '@epyc/shared/types';

export interface NormalizedBrokerJob {
  broker_job_id: string;
  broker_reference?: string;

  // Pickup
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  pickup_instructions?: string;
  pickup_window_start?: string;
  pickup_window_end?: string;

  // Delivery
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  delivery_instructions?: string;
  delivery_window_start?: string;
  delivery_window_end?: string;

  // Package
  package_description?: string;
  package_weight?: number;

  // Service
  service_level: ServiceLevel;
  vehicle_required?: VehicleType;

  // Flags
  is_medical?: boolean;
  is_hipaa?: boolean;
  requires_signature?: boolean;
  requires_temperature_control?: boolean;
  temperature_min?: number;
  temperature_max?: number;

  // Pricing (broker-provided)
  broker_price?: number;
  broker_payout?: number;
}

export interface BrokerAdapter {
  normalize(rawPayload: unknown): NormalizedBrokerJob;
  formatStatusUpdate(delivery: Delivery, event: string): unknown;
}
