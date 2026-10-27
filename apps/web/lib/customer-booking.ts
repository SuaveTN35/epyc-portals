// Builds the deliveries row a customer inserts from the booking form.
// Only live columns (packages/supabase/LIVE-SCHEMA-SNAPSHOT-2026-10-27.md).
// Pricing values are copied from the quote unchanged. driver_payout is not
// sent: the insert guard (20261028000200) nulls it for customers and dispatch
// sets it when offering the job. Payment state lives in the payments table.

export interface BookingForm {
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  delivery_instructions: string;
  package_description: string;
  package_weight: number | string;
  package_length: number | string;
  package_width: number | string;
  package_height: number | string;
  requires_signature: boolean;
  is_fragile: boolean;
  is_medical: boolean;
  is_hipaa: boolean;
  requires_temperature_control: boolean;
  temperature_min: number | string;
  temperature_max: number | string;
  service_level: string;
}

export interface BookingQuote {
  distance_miles: number;
  estimated_duration_minutes: number;
  base_price: number;
  distance_price: number;
  weight_surcharge: number;
  rush_surcharge: number;
  hipaa_surcharge: number;
  temperature_surcharge: number;
  total_price: number;
  vehicle_required: string;
}

export interface Coords {
  lat: number;
  lng: number;
}

export function buildCustomerBookingRow(args: {
  customerId: string;
  trackingNumber: string;
  form: BookingForm;
  quote: BookingQuote;
  pickup: Coords | null;
  dropoff: Coords | null;
  now?: Date;
}): Record<string, unknown> {
  const { customerId, trackingNumber, form, quote, pickup, dropoff } = args;
  const now = args.now ?? new Date();
  return {
    tracking_number: trackingNumber,
    customer_id: customerId,
    status: 'booked',
    booked_at: now.toISOString(),
    // Pickup
    pickup_address: form.pickup_address,
    pickup_city: form.pickup_city,
    pickup_state: form.pickup_state,
    pickup_zip: form.pickup_zip,
    pickup_lat: pickup?.lat ?? null,
    pickup_lng: pickup?.lng ?? null,
    pickup_contact_name: form.pickup_contact_name,
    pickup_contact_phone: form.pickup_contact_phone,
    pickup_instructions: form.pickup_instructions,
    // Delivery
    delivery_address: form.delivery_address,
    delivery_city: form.delivery_city,
    delivery_state: form.delivery_state,
    delivery_zip: form.delivery_zip,
    delivery_lat: dropoff?.lat ?? null,
    delivery_lng: dropoff?.lng ?? null,
    delivery_contact_name: form.delivery_contact_name,
    delivery_contact_phone: form.delivery_contact_phone,
    delivery_instructions: form.delivery_instructions,
    // Package
    package_description: form.package_description,
    package_weight: form.package_weight,
    package_length: form.package_length,
    package_width: form.package_width,
    package_height: form.package_height,
    requires_signature: form.requires_signature,
    is_fragile: form.is_fragile,
    is_medical: form.is_medical,
    is_hipaa: form.is_hipaa,
    requires_temperature_control: form.requires_temperature_control,
    temperature_min: form.requires_temperature_control ? form.temperature_min : null,
    temperature_max: form.requires_temperature_control ? form.temperature_max : null,
    // Pricing (from the quote, unchanged)
    distance_miles: quote.distance_miles,
    estimated_duration_minutes: quote.estimated_duration_minutes,
    base_price: quote.base_price,
    distance_price: quote.distance_price,
    weight_surcharge: quote.weight_surcharge,
    rush_surcharge: quote.rush_surcharge,
    hipaa_surcharge: quote.hipaa_surcharge,
    temperature_surcharge: quote.temperature_surcharge,
    total_price: quote.total_price,
    // Service
    service_level: form.service_level,
    vehicle_required: quote.vehicle_required,
  };
}
