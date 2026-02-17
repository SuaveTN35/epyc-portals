// User & Authentication Types
export type UserRole = 'customer' | 'driver' | 'dispatcher' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  company_name?: string;
  company_id?: string;
  stripe_customer_id?: string;
  stripe_connect_id?: string;
  created_at: string;
  updated_at: string;
}

// Company Types
export interface Company {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  billing_email?: string;
  hipaa_compliant: boolean;
  api_key?: string;
  created_at: string;
}

// Driver Types
export type VehicleType = 'car' | 'suv' | 'van' | 'truck' | 'box_truck';
export type BackgroundCheckStatus = 'pending' | 'approved' | 'rejected';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Driver {
  id: string;
  profile_id: string;
  license_number: string;
  license_state: string;
  license_expiry: string;
  vehicle_type: VehicleType;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_plate?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
  background_check_status: BackgroundCheckStatus;
  background_check_date?: string;
  hipaa_certified: boolean;
  hipaa_cert_expiry?: string;
  max_weight_capacity?: number;
  has_temperature_control: boolean;
  current_lat?: number;
  current_lng?: number;
  is_online: boolean;
  rating: number;
  total_deliveries: number;
  loyalty_tier: LoyaltyTier;
  created_at: string;
  // Joined fields
  profile?: Profile;
}

// Delivery Types
export type DeliveryStatus =
  | 'quote_requested'
  | 'quoted'
  | 'booked'
  | 'assigned'
  | 'en_route_pickup'
  | 'arrived_pickup'
  | 'picked_up'
  | 'en_route_delivery'
  | 'arrived_delivery'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type ServiceLevel = 'standard' | 'priority' | 'rush' | 'scheduled';

export interface Delivery {
  id: string;
  tracking_number: string;
  customer_id: string;
  company_id?: string;
  driver_id?: string;
  status: DeliveryStatus;

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
  actual_pickup_time?: string;

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
  actual_delivery_time?: string;

  // Package
  package_description?: string;
  package_weight?: number;
  package_length?: number;
  package_width?: number;
  package_height?: number;
  requires_signature: boolean;
  requires_photo_pod: boolean;
  is_fragile: boolean;
  is_medical: boolean;
  is_hipaa: boolean;
  requires_temperature_control: boolean;
  temperature_min?: number;
  temperature_max?: number;

  // Pricing
  distance_miles?: number;
  estimated_duration_minutes?: number;
  base_price?: number;
  distance_price?: number;
  weight_surcharge?: number;
  rush_surcharge?: number;
  hipaa_surcharge?: number;
  temperature_surcharge?: number;
  total_price?: number;
  driver_payout?: number;
  tip_amount?: number;

  // Service
  service_level: ServiceLevel;
  vehicle_required?: VehicleType;

  // Timestamps
  quoted_at?: string;
  booked_at?: string;
  assigned_at?: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  customer?: Profile;
  driver?: Driver;
  company?: Company;
}

// Delivery Event Types
export interface DeliveryEvent {
  id: string;
  delivery_id: string;
  event_type: string;
  old_status?: DeliveryStatus;
  new_status?: DeliveryStatus;
  lat?: number;
  lng?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// Proof of Delivery Types
export type PODType = 'signature' | 'photo' | 'barcode' | 'otp' | 'temperature';

export interface ProofOfDelivery {
  id: string;
  delivery_id: string;
  type: PODType;
  signature_data?: string;
  photo_url?: string;
  barcode_value?: string;
  otp_code?: string;
  temperature_reading?: number;
  recipient_name?: string;
  recipient_relation?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  captured_at: string;
}

// Temperature Log Types
export interface TemperatureLog {
  id: string;
  delivery_id: string;
  driver_id?: string;
  temperature: number;
  lat?: number;
  lng?: number;
  recorded_at: string;
}

// Driver Location Types
export interface DriverLocation {
  id: string;
  driver_id: string;
  delivery_id?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  recorded_at: string;
}

// Payment Types
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  delivery_id: string;
  customer_id: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  amount: number;
  tip_amount?: number;
  status: PaymentStatus;
  paid_at?: string;
  created_at: string;
}

// Driver Payout Types
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type PayoutMethod = 'instant' | 'standard';

export interface DriverPayout {
  id: string;
  driver_id: string;
  delivery_id?: string;
  stripe_transfer_id?: string;
  amount: number;
  tip_amount?: number;
  status: PayoutStatus;
  payout_method: PayoutMethod;
  paid_at?: string;
  created_at: string;
}

// Rating Types
export interface Rating {
  id: string;
  delivery_id: string;
  rated_by: string;
  rated_user?: string;
  rated_driver?: string;
  rating: number;
  review?: string;
  created_at: string;
}

// Support Ticket Types
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  delivery_id?: string;
  created_by: string;
  assigned_to?: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  resolved_at?: string;
  created_at: string;
}

// Notification Types
export type NotificationType = 'sms' | 'email' | 'push';

export interface Notification {
  id: string;
  user_id: string;
  delivery_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  sent_at: string;
}

// Quote Types
export interface QuoteRequest {
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  package_weight?: number;
  package_length?: number;
  package_width?: number;
  package_height?: number;
  service_level: ServiceLevel;
  vehicle_required?: VehicleType;
  is_medical?: boolean;
  is_hipaa?: boolean;
  requires_temperature_control?: boolean;
  temperature_min?: number;
  temperature_max?: number;
}

export interface QuoteResponse {
  quote_id: string;
  distance_miles: number;
  estimated_duration_minutes: number;
  base_price: number;
  distance_price: number;
  weight_surcharge: number;
  hipaa_surcharge: number;
  temperature_surcharge: number;
  rush_surcharge: number;
  service_multiplier: number;
  total_price: number;
  driver_payout: number;
  vehicle_required: VehicleType;
  expires_at: string;
}

// Job Offer Types (for drivers)
export interface JobOffer {
  id: string;
  delivery_id: string;
  driver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  estimated_payout: number;
  estimated_duration_minutes: number;
  distance_to_pickup_miles: number;
  created_at: string;
  delivery?: Delivery;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Coordinate Types
export interface Coordinates {
  lat: number;
  lng: number;
}

// Broker Types
export type BrokerType = 'medical' | 'logistics' | 'b2b_client';

export interface Broker {
  id: string;
  company_id: string;
  name: string;
  type: BrokerType;
  is_active: boolean;
  auto_accept: boolean;
  auto_accept_max_distance_miles?: number;
  auto_accept_service_levels?: ServiceLevel[];
  callback_url?: string;
  callback_headers?: Record<string, string>;
  callback_events: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BrokerDelivery {
  id: string;
  broker_id: string;
  delivery_id: string;
  broker_job_id: string;
  broker_reference?: string;
  raw_payload: Record<string, unknown>;
  last_status_sent?: string;
  last_callback_at?: string;
  last_callback_status?: number;
  callback_attempts: number;
  callback_error?: string;
  created_at: string;
  // Joined fields
  broker?: Broker;
  delivery?: Delivery;
}

export interface BrokerWebhookLog {
  id: string;
  broker_id?: string;
  direction: 'inbound' | 'outbound';
  endpoint?: string;
  request_body?: Record<string, unknown>;
  response_status?: number;
  response_body?: Record<string, unknown>;
  processing_time_ms?: number;
  error?: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-STOP TRIP & 1099 OWNER-OPERATOR MODEL
// ═══════════════════════════════════════════════════════════════════

export interface MultiStopQuoteRequest {
  stops: Array<{
    address: string;
    city: string;
    state: string;
    zip: string;
    contact_name?: string;
    contact_phone?: string;
    instructions?: string;
    estimated_wait_minutes?: number;
  }>;
  total_route_miles: number;
  vehicle_type?: VehicleType;
  service_level: ServiceLevel;
  package_weight?: number;
  is_hipaa?: boolean;
  requires_temperature_control?: boolean;
  is_after_hours?: boolean;
  driver_payout_override?: number;
}

export interface TripProfitability {
  // Client-facing
  client_price: number;
  price_breakdown: {
    base_fee: number;
    additional_stops_fee: number;
    mileage_fee: number;
    wait_time_fee: number;
    weight_surcharge: number;
    hipaa_surcharge: number;
    temperature_surcharge: number;
    after_hours_surcharge: number;
    subtotal_before_multiplier: number;
    service_multiplier: number;
  };

  // Driver payout
  driver_payout: number;
  driver_payout_percentage: number;
  driver_effective_hourly: number;

  // Epyc profit
  epyc_gross: number;
  stripe_fee: number;
  overhead_per_trip: number;
  epyc_net_profit: number;
  epyc_margin_percentage: number;

  // Trip details
  total_route_miles: number;
  number_of_stops: number;
  estimated_duration_minutes: number;
  vehicle_type: VehicleType;
  service_level: ServiceLevel;

  // Platform comparison
  platform_comparison: {
    dispatchit_would_charge_client: number;
    dispatchit_would_pay_driver: number;
    epyc_driver_advantage: number;
    epyc_driver_advantage_percentage: number;
    epyc_client_savings: number;
  };
}

// Dashboard Stats Types
export interface DashboardStats {
  total_deliveries: number;
  active_deliveries: number;
  completed_today: number;
  total_revenue: number;
  on_time_rate: number;
  average_rating: number;
  online_drivers: number;
}

export interface DriverStats {
  total_deliveries: number;
  total_earnings: number;
  average_rating: number;
  on_time_rate: number;
  this_week_earnings: number;
  this_week_deliveries: number;
}
