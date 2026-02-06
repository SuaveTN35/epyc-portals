import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const addressSchema = z.object({
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(50),
  zip: z.string().min(5, 'ZIP code is required').max(20),
  lat: z.number().optional(),
  lng: z.number().optional(),
  contact_name: z.string().max(200).optional(),
  contact_phone: z.string().max(50).optional(),
  instructions: z.string().max(1000).optional(),
});

// Distance API
export const distanceRequestSchema = z.object({
  origin: coordinatesSchema,
  destination: coordinatesSchema,
});

// Payment Intent API
export const createPaymentIntentSchema = z.object({
  amount: z.number().int().min(100, 'Minimum amount is $1.00 (100 cents)').max(10000000),
  delivery_id: uuidSchema,
  metadata: z.record(z.string()).optional(),
});

// Broker Delivery API - Medical payload
export const medicalBrokerPayloadSchema = z.object({
  order_id: z.string().min(1, 'order_id is required').max(200),
  reference_number: z.string().max(200).optional(),
  patient_id: z.string().max(200).optional(),
  origin: z.object({
    facility_name: z.string().max(200).optional(),
    address: z.string().min(1, 'Origin address is required').max(500),
    city: z.string().min(1, 'Origin city is required').max(100),
    state: z.string().min(2, 'Origin state is required').max(50),
    zip: z.string().min(5, 'Origin ZIP is required').max(20),
    lat: z.number().optional(),
    lng: z.number().optional(),
    contact_name: z.string().max(200).optional(),
    contact_phone: z.string().max(50).optional(),
    instructions: z.string().max(1000).optional(),
    ready_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
  destination: z.object({
    facility_name: z.string().max(200).optional(),
    address: z.string().min(1, 'Destination address is required').max(500),
    city: z.string().min(1, 'Destination city is required').max(100),
    state: z.string().min(2, 'Destination state is required').max(50),
    zip: z.string().min(5, 'Destination ZIP is required').max(20),
    lat: z.number().optional(),
    lng: z.number().optional(),
    contact_name: z.string().max(200).optional(),
    contact_phone: z.string().max(50).optional(),
    instructions: z.string().max(1000).optional(),
    delivery_by: z.string().optional(),
  }),
  specimen: z.object({
    type: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    weight_lbs: z.number().positive().max(1000).optional(),
    temperature_sensitive: z.boolean().optional(),
    temp_min_f: z.number().optional(),
    temp_max_f: z.number().optional(),
  }).optional(),
  hipaa_required: z.boolean().optional(),
  priority: z.string().max(50).optional(),
  price: z.number().positive().max(100000).optional(),
  driver_pay: z.number().positive().max(100000).optional(),
});

// Broker Delivery API - Logistics payload
export const logisticsBrokerPayloadSchema = z.object({
  load_id: z.string().min(1, 'load_id is required').max(200),
  reference: z.string().max(200).optional(),
  shipper: z.object({
    company: z.string().max(200).optional(),
    address: z.string().min(1).max(500),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(50),
    zip: z.string().min(5).max(20),
    lat: z.number().optional(),
    lng: z.number().optional(),
    contact: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
    pickup_date: z.string().optional(),
    pickup_time_start: z.string().optional(),
    pickup_time_end: z.string().optional(),
  }),
  consignee: z.object({
    company: z.string().max(200).optional(),
    address: z.string().min(1).max(500),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(50),
    zip: z.string().min(5).max(20),
    lat: z.number().optional(),
    lng: z.number().optional(),
    contact: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
    delivery_date: z.string().optional(),
    delivery_time_start: z.string().optional(),
    delivery_time_end: z.string().optional(),
  }),
  cargo: z.object({
    description: z.string().max(500).optional(),
    weight: z.number().positive().max(100000).optional(),
    pieces: z.number().int().positive().max(10000).optional(),
    dimensions: z.string().max(200).optional(),
    hazmat: z.boolean().optional(),
  }).optional(),
  equipment: z.enum(['car', 'suv', 'van', 'truck', 'box_truck']).optional(),
  service: z.enum(['standard', 'expedited', 'hot_shot', 'same_day']).optional(),
  rate: z.number().positive().max(100000).optional(),
  driver_rate: z.number().positive().max(100000).optional(),
});

// Generic B2B payload
export const genericBrokerPayloadSchema = z.object({
  job_id: z.string().min(1, 'job_id is required').max(200),
  reference: z.string().max(200).optional(),
  pickup: addressSchema,
  delivery: addressSchema,
  package: z.object({
    description: z.string().max(500).optional(),
    weight: z.number().positive().max(10000).optional(),
  }).optional(),
  service_level: z.enum(['standard', 'priority', 'rush', 'scheduled']).optional(),
  vehicle_required: z.enum(['car', 'suv', 'van', 'truck', 'box_truck']).optional(),
  requires_signature: z.boolean().optional(),
  price: z.number().positive().max(100000).optional(),
  driver_payout: z.number().positive().max(100000).optional(),
  scheduled_pickup: z.string().optional(),
  scheduled_delivery: z.string().optional(),
});

// Delivery creation (client form)
export const createDeliverySchema = z.object({
  pickup_address: z.string().min(1, 'Pickup address is required').max(500),
  pickup_city: z.string().min(1, 'Pickup city is required').max(100),
  pickup_state: z.string().min(2, 'Pickup state is required').max(50),
  pickup_zip: z.string().min(5, 'Pickup ZIP is required').max(20),
  pickup_lat: z.number().optional(),
  pickup_lng: z.number().optional(),
  pickup_contact_name: z.string().max(200).optional(),
  pickup_contact_phone: z.string().max(50).optional(),
  pickup_instructions: z.string().max(1000).optional(),

  delivery_address: z.string().min(1, 'Delivery address is required').max(500),
  delivery_city: z.string().min(1, 'Delivery city is required').max(100),
  delivery_state: z.string().min(2, 'Delivery state is required').max(50),
  delivery_zip: z.string().min(5, 'Delivery ZIP is required').max(20),
  delivery_lat: z.number().optional(),
  delivery_lng: z.number().optional(),
  delivery_contact_name: z.string().max(200).optional(),
  delivery_contact_phone: z.string().max(50).optional(),
  delivery_instructions: z.string().max(1000).optional(),

  package_description: z.string().max(500).optional(),
  package_weight: z.number().positive().max(10000).optional(),
  service_level: z.enum(['standard', 'priority', 'rush', 'scheduled']).default('standard'),
  vehicle_required: z.enum(['car', 'suv', 'van', 'truck', 'box_truck']).optional(),
  requires_signature: z.boolean().default(false),
  requires_photo_pod: z.boolean().default(true),
  is_medical: z.boolean().default(false),
  is_hipaa: z.boolean().default(false),
  scheduled_pickup_time: z.string().optional(),
  scheduled_delivery_time: z.string().optional(),
});

// Type exports
export type DistanceRequest = z.infer<typeof distanceRequestSchema>;
export type CreatePaymentIntent = z.infer<typeof createPaymentIntentSchema>;
export type MedicalBrokerPayload = z.infer<typeof medicalBrokerPayloadSchema>;
export type LogisticsBrokerPayload = z.infer<typeof logisticsBrokerPayloadSchema>;
export type GenericBrokerPayload = z.infer<typeof genericBrokerPayloadSchema>;
export type CreateDelivery = z.infer<typeof createDeliverySchema>;

// Validation helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError['errors'] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
}
