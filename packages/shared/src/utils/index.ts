import type { QuoteRequest, QuoteResponse, VehicleType, ServiceLevel, Coordinates, DeliveryStatus } from '../types';
import { VEHICLE_CONFIG, SERVICE_LEVEL_CONFIG, PRICING, DELIVERY_STATUS_CONFIG } from '../constants';

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Determine required vehicle type based on package dimensions/weight
 */
export function determineVehicleType(
  weight?: number,
  length?: number,
  width?: number,
  height?: number
): VehicleType {
  const maxWeight = weight || 0;
  const volume = (length || 0) * (width || 0) * (height || 0);

  if (maxWeight > 500 || volume > 50000) return 'box_truck';
  if (maxWeight > 250 || volume > 25000) return 'truck';
  if (maxWeight > 75 || volume > 10000) return 'van';
  if (maxWeight > 25 || volume > 3000) return 'suv';
  return 'car';
}

/**
 * Calculate delivery quote
 */
export function calculateQuote(
  request: QuoteRequest,
  distanceMiles: number
): Omit<QuoteResponse, 'quote_id' | 'expires_at'> {
  // Determine vehicle type if not specified
  const vehicleRequired = request.vehicle_required || determineVehicleType(
    request.package_weight,
    request.package_length,
    request.package_width,
    request.package_height
  );

  const vehicleConfig = VEHICLE_CONFIG[vehicleRequired];
  const serviceLevelConfig = SERVICE_LEVEL_CONFIG[request.service_level];

  // Base calculations
  const basePrice = vehicleConfig.baseRate;
  const distancePrice = distanceMiles * vehicleConfig.perMileRate;

  // Weight surcharge (over 50 lbs)
  let weightSurcharge = 0;
  if (request.package_weight && request.package_weight > PRICING.weightSurchargeThreshold) {
    const overWeight = request.package_weight - PRICING.weightSurchargeThreshold;
    const increments = Math.ceil(overWeight / PRICING.weightSurchargeIncrement);
    weightSurcharge = increments * PRICING.weightSurchargeAmount;
  }

  // Service surcharges
  const hipaaSurcharge = request.is_hipaa ? PRICING.hipaaSurcharge : 0;
  const temperatureSurcharge = request.requires_temperature_control ? PRICING.temperatureSurcharge : 0;
  const rushSurcharge = request.service_level === 'rush' ? (basePrice + distancePrice) * 0.3 : 0;

  // Calculate subtotal
  const subtotal = basePrice + distancePrice + weightSurcharge + hipaaSurcharge + temperatureSurcharge + rushSurcharge;

  // Apply service level multiplier
  const totalPrice = Math.round(subtotal * serviceLevelConfig.multiplier * 100) / 100;

  // Driver payout (75% of base, 100% of tips)
  const driverPayout = Math.round(totalPrice * PRICING.driverPayoutPercentage * 100) / 100;

  // Estimated duration (average 24 mph in LA traffic)
  const estimatedDurationMinutes = Math.ceil(distanceMiles * 2.5);

  return {
    distance_miles: Math.round(distanceMiles * 100) / 100,
    estimated_duration_minutes: estimatedDurationMinutes,
    base_price: basePrice,
    distance_price: Math.round(distancePrice * 100) / 100,
    weight_surcharge: weightSurcharge,
    hipaa_surcharge: hipaaSurcharge,
    temperature_surcharge: temperatureSurcharge,
    rush_surcharge: Math.round(rushSurcharge * 100) / 100,
    service_multiplier: serviceLevelConfig.multiplier,
    total_price: totalPrice,
    driver_payout: driverPayout,
    vehicle_required: vehicleRequired,
  };
}

/**
 * Generate tracking number
 */
export function generateTrackingNumber(): string {
  const prefix = 'EPYC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format distance
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
}

/**
 * Get delivery status configuration
 */
export function getStatusConfig(status: DeliveryStatus) {
  return DELIVERY_STATUS_CONFIG[status];
}

/**
 * Check if delivery is active (can be tracked)
 */
export function isDeliveryActive(status: DeliveryStatus): boolean {
  const inactiveStatuses: DeliveryStatus[] = ['quote_requested', 'quoted', 'delivered', 'cancelled', 'failed'];
  return !inactiveStatuses.includes(status);
}

/**
 * Check if delivery is complete
 */
export function isDeliveryComplete(status: DeliveryStatus): boolean {
  return ['delivered', 'cancelled', 'failed'].includes(status);
}

/**
 * Check if driver can update status
 */
export function canDriverUpdateStatus(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): boolean {
  const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
    assigned: ['en_route_pickup'],
    en_route_pickup: ['arrived_pickup'],
    arrived_pickup: ['picked_up'],
    picked_up: ['en_route_delivery'],
    en_route_delivery: ['arrived_delivery'],
    arrived_delivery: ['delivered', 'failed'],
    // These statuses cannot be changed by driver
    quote_requested: [],
    quoted: [],
    booked: [],
    delivered: [],
    cancelled: [],
    failed: [],
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * Calculate ETA based on distance and current time
 */
export function calculateETA(distanceMiles: number, currentTime: Date = new Date()): Date {
  // Average speed assumption: 24 mph in LA traffic
  const durationMinutes = Math.ceil(distanceMiles * 2.5);
  const eta = new Date(currentTime);
  eta.setMinutes(eta.getMinutes() + durationMinutes);
  return eta;
}

/**
 * Format ETA for display
 */
export function formatETA(eta: Date): string {
  const now = new Date();
  const diffMs = eta.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'Arriving now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  return eta.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Format address for display
 */
export function formatAddress(address: string, city: string, state: string, zip: string): string {
  return `${address}, ${city}, ${state} ${zip}`;
}

/**
 * Parse address into components (basic implementation)
 */
export function parseAddress(fullAddress: string): {
  address: string;
  city: string;
  state: string;
  zip: string;
} | null {
  // Match pattern: "123 Main St, City, ST 12345" or "123 Main St, City, State 12345"
  const match = fullAddress.match(/^(.+),\s*(.+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i);
  if (match) {
    return {
      address: match[1].trim(),
      city: match[2].trim(),
      state: match[3].toUpperCase(),
      zip: match[4],
    };
  }
  return null;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Generate random color (for map markers, etc.)
 */
export function generateColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
