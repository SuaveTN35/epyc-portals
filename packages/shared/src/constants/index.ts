import type { DeliveryStatus, ServiceLevel, VehicleType, LoyaltyTier } from '../types';

// Company Information
export const COMPANY = {
  name: 'EPYC Courier Service',
  legal_name: 'UDIG Solutions Inc dba Epyc Courier Service',
  phone: '(818) 217-0070',
  email: 'rico@epyccs.com',
  website: 'https://epyccs.com',
  address: 'Los Angeles, CA',
  territory: 'Los Angeles Metropolitan Area',
} as const;

// Delivery Status Labels & Colors
export const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bgColor: string }> = {
  quote_requested: { label: 'Quote Requested', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  quoted: { label: 'Quoted', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  booked: { label: 'Booked', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  assigned: { label: 'Driver Assigned', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  en_route_pickup: { label: 'En Route to Pickup', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  arrived_pickup: { label: 'At Pickup', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  picked_up: { label: 'Picked Up', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  en_route_delivery: { label: 'En Route to Delivery', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  arrived_delivery: { label: 'At Delivery', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  delivered: { label: 'Delivered', color: 'text-green-600', bgColor: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-100' },
  failed: { label: 'Failed', color: 'text-red-600', bgColor: 'bg-red-100' },
} as const;

// Service Level Configuration
export const SERVICE_LEVEL_CONFIG: Record<ServiceLevel, { label: string; description: string; multiplier: number }> = {
  standard: { label: 'Standard', description: '2-4 hour delivery', multiplier: 1.0 },
  priority: { label: 'Priority', description: '1-2 hour delivery', multiplier: 1.3 },
  rush: { label: 'Rush', description: 'Under 1 hour', multiplier: 1.8 },
  scheduled: { label: 'Scheduled', description: 'Pick your time window', multiplier: 1.0 },
} as const;

// Vehicle Type Configuration
export const VEHICLE_CONFIG: Record<VehicleType, {
  label: string;
  description: string;
  baseRate: number;
  perMileRate: number;
  maxWeight: number;
  icon: string;
}> = {
  car: {
    label: 'Car',
    description: 'Small packages, documents',
    baseRate: 8.00,
    perMileRate: 1.50,
    maxWeight: 25,
    icon: '🚗'
  },
  suv: {
    label: 'SUV',
    description: 'Medium packages',
    baseRate: 10.00,
    perMileRate: 1.75,
    maxWeight: 75,
    icon: '🚙'
  },
  van: {
    label: 'Cargo Van',
    description: 'Large packages, multiple items',
    baseRate: 15.00,
    perMileRate: 2.25,
    maxWeight: 250,
    icon: '🚐'
  },
  truck: {
    label: 'Pickup Truck',
    description: 'Heavy/bulky items',
    baseRate: 25.00,
    perMileRate: 3.00,
    maxWeight: 500,
    icon: '🛻'
  },
  box_truck: {
    label: 'Box Truck',
    description: 'Commercial/bulk deliveries',
    baseRate: 40.00,
    perMileRate: 4.00,
    maxWeight: 2000,
    icon: '🚚'
  },
} as const;

// Loyalty Tier Configuration
export const LOYALTY_TIER_CONFIG: Record<LoyaltyTier, {
  label: string;
  minDeliveries: number;
  priorityScore: number;
  perks: string[];
}> = {
  bronze: {
    label: 'Bronze',
    minDeliveries: 0,
    priorityScore: 1.0,
    perks: ['Standard job matching', 'Weekly payouts']
  },
  silver: {
    label: 'Silver',
    minDeliveries: 50,
    priorityScore: 1.1,
    perks: ['Priority job matching', 'Instant payouts', 'Dedicated support line']
  },
  gold: {
    label: 'Gold',
    minDeliveries: 200,
    priorityScore: 1.25,
    perks: ['Top priority matching', 'Zero-fee instant payouts', 'First access to premium routes']
  },
  platinum: {
    label: 'Platinum',
    minDeliveries: 500,
    priorityScore: 1.4,
    perks: ['Exclusive high-value routes', 'Personal account manager', 'Bonus incentives']
  },
} as const;

// Pricing Configuration
export const PRICING = {
  // Weight surcharge (per 25 lbs over 50 lbs)
  weightSurchargeThreshold: 50, // lbs
  weightSurchargeIncrement: 25, // lbs
  weightSurchargeAmount: 5.00, // dollars

  // Special service surcharges
  hipaaSurcharge: 15.00,
  temperatureSurcharge: 25.00,

  // Driver payout percentage (single delivery via app)
  driverPayoutPercentage: 0.60, // 60% of base (tips are 100%) — 1099 owner-operator model

  // Instant payout fee (we absorb this - competitor differentiator)
  instantPayoutFee: 0.00, // FREE - competitors charge 2-2.5%

  // Cancellation compensation (if customer cancels after driver en route)
  cancellationCompensationPercentage: 0.50, // 50% of job value
} as const;

// Job Offer Configuration
export const JOB_OFFER = {
  timeoutSeconds: 60, // 1-to-1 matching, 60 seconds to accept
  maxDriverRadius: 15, // miles - max distance to consider drivers
} as const;

// Temperature Ranges (Celsius)
export const TEMPERATURE_RANGES = {
  ambient: { min: 15, max: 25, label: 'Ambient (59-77°F)' },
  refrigerated: { min: 2, max: 8, label: 'Refrigerated (36-46°F)' },
  frozen: { min: -25, max: -15, label: 'Frozen (-13 to 5°F)' },
  controlled: { min: 15, max: 30, label: 'Controlled Room Temp (59-86°F)' },
} as const;

// HIPAA Configuration
export const HIPAA = {
  sessionTimeoutMinutes: 15,
  auditRetentionYears: 6,
  encryptionAlgorithm: 'AES-256',
} as const;

// Service Areas (Counties served)
export const SERVICE_AREAS = [
  { name: 'Los Angeles County', cities: ['Los Angeles', 'Long Beach', 'Glendale', 'Santa Clarita', 'Pasadena', 'Torrance'] },
  { name: 'Orange County', cities: ['Anaheim', 'Santa Ana', 'Irvine', 'Huntington Beach', 'Newport Beach'] },
  { name: 'San Diego County', cities: ['San Diego', 'Chula Vista', 'Oceanside', 'Carlsbad'] },
  { name: 'Inland Empire', cities: ['Riverside', 'San Bernardino', 'Ontario', 'Rancho Cucamonga'] },
] as const;

// ═══════════════════════════════════════════════════════════════════
// 1099 OWNER-OPERATOR MODEL — MULTI-STOP TRIP PRICING
// ═══════════════════════════════════════════════════════════════════

// Multi-stop pricing by vehicle type
export const MULTI_STOP_PRICING: Record<VehicleType, {
  baseFee: number;          // Includes pickup + first delivery stop
  perAdditionalStop: number; // Each stop after the first delivery
  perMileRate: number;       // Per total route mile
  minimumTripPrice: number;
}> = {
  car: { baseFee: 35.00, perAdditionalStop: 20.00, perMileRate: 2.50, minimumTripPrice: 45.00 },
  suv: { baseFee: 45.00, perAdditionalStop: 25.00, perMileRate: 3.00, minimumTripPrice: 55.00 },
  van: { baseFee: 65.00, perAdditionalStop: 30.00, perMileRate: 3.50, minimumTripPrice: 75.00 },
  truck: { baseFee: 85.00, perAdditionalStop: 35.00, perMileRate: 4.00, minimumTripPrice: 95.00 },
  box_truck: { baseFee: 120.00, perAdditionalStop: 45.00, perMileRate: 5.00, minimumTripPrice: 135.00 },
} as const;

// Wait time charges
export const WAIT_TIME = {
  freeMinutesPerStop: 10,
  perMinuteCharge: 1.50,
} as const;

// After-hours surcharge
export const AFTER_HOURS_SURCHARGE = 0.20; // 20% of subtotal

// Driver payout tiers by trip type
export const DRIVER_PAYOUT_TIERS = {
  shortLocal: 0.55,       // Under 10 miles
  standardMultiStop: 0.60, // Default
  longRoute: 0.65,         // 50+ miles
  medical: 0.55,           // HIPAA — premium surcharge covers driver
  scheduledDaily: 0.50,    // Guaranteed volume = guaranteed income
} as const;

// Platform costs (Epyc overhead per transaction)
export const PLATFORM_COSTS = {
  stripe: {
    percentage: 0.029,
    fixedFee: 0.30,
  },
  monthlyOverhead: {
    software: 200,      // Supabase, Vercel, Maps API
    insurance: 400,     // General liability + cargo
    marketing: 300,     // Ads, content, SEO
    dispatchLabor: 0,   // Commander dispatches for now
    total: 900,
  },
} as const;

// Competitor benchmarks (for comparison calculations)
export const COMPETITOR_BENCHMARKS = {
  dispatchit: {
    platformMarkup: 3.5,          // They charge ~3.5x what they pay drivers
    driverPayoutPercentage: 0.26, // ~26% to driver
  },
  curri: {
    platformMarkup: 3.0,
    driverPayoutPercentage: 0.30,
  },
} as const;

// API Configuration
export const API = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
} as const;

// Map Configuration
export const MAP = {
  defaultCenter: { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  defaultZoom: 11,
  driverUpdateIntervalMs: 5000, // 5 seconds
} as const;

// File Upload Limits
export const FILE_LIMITS = {
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxSignatureSize: 1 * 1024 * 1024, // 1MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

// Notification Messages
export const NOTIFICATIONS = {
  deliveryAssigned: (trackingNumber: string) =>
    `A driver has been assigned to your delivery ${trackingNumber}`,
  driverEnRoute: (trackingNumber: string, eta: number) =>
    `Your driver is on the way! ETA: ${eta} minutes. Tracking: ${trackingNumber}`,
  pickedUp: (trackingNumber: string) =>
    `Your package has been picked up. Tracking: ${trackingNumber}`,
  outForDelivery: (trackingNumber: string, eta: number) =>
    `Your package is out for delivery! ETA: ${eta} minutes. Tracking: ${trackingNumber}`,
  delivered: (trackingNumber: string) =>
    `Your package has been delivered! Tracking: ${trackingNumber}`,
  temperatureAlert: (trackingNumber: string, temp: number, range: string) =>
    `Temperature alert for ${trackingNumber}: ${temp}°C (expected: ${range})`,
} as const;
