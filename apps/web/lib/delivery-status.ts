// Delivery and driver status values that match the live database CHECK
// constraints (see packages/supabase/LIVE-SCHEMA-SNAPSHOT-2026-10-27.md).
// Dispatch screens import from here so filters, badges, and counts never drift
// from the 12 statuses the deliveries table actually accepts.

import { DELIVERY_STATUS_CONFIG } from '@epyc/shared';
import type { DeliveryStatus } from '@epyc/shared';

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  'quote_requested',
  'quoted',
  'booked',
  'assigned',
  'en_route_pickup',
  'arrived_pickup',
  'picked_up',
  'en_route_delivery',
  'arrived_delivery',
  'delivered',
  'cancelled',
  'failed',
];

// Booked and paid for, waiting on a driver. This replaces the old 'pending'.
export const AWAITING_ASSIGNMENT_STATUSES: DeliveryStatus[] = ['booked'];

// A driver is attached and the job is not finished. This replaces the old
// 'assigned' / 'picked_up' / 'in_transit' trio.
export const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  'assigned',
  'en_route_pickup',
  'arrived_pickup',
  'picked_up',
  'en_route_delivery',
  'arrived_delivery',
];

// Jobs that can still be (re)assigned to a driver from dispatch.
export const ASSIGNABLE_STATUSES: DeliveryStatus[] = ['booked', 'assigned'];

// Jobs dispatch may still cancel.
export const CANCELLABLE_STATUSES: DeliveryStatus[] = [
  'quote_requested',
  'quoted',
  'booked',
  'assigned',
  'en_route_pickup',
  'arrived_pickup',
];

export function deliveryStatusLabel(status: string): string {
  return DELIVERY_STATUS_CONFIG[status as DeliveryStatus]?.label ?? status.replace(/_/g, ' ');
}

export function deliveryStatusBadge(status: string): string {
  const cfg = DELIVERY_STATUS_CONFIG[status as DeliveryStatus];
  return cfg ? `${cfg.bgColor} ${cfg.color}` : 'bg-gray-100 text-gray-800';
}

// drivers.status (added by migration 20261027000100).
export type DriverAccountStatus = 'pending' | 'active' | 'suspended' | 'inactive';

export const DRIVER_STATUSES: DriverAccountStatus[] = ['pending', 'active', 'suspended', 'inactive'];

export const DRIVER_STATUS_BADGE: Record<DriverAccountStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-800',
};

// Driver documents are stored as paths inside the private driver-documents
// bucket. Older rows hold a full public URL; strip it back to the path.
export function toDriverDocumentPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = '/object/public/driver-documents/';
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length);
  const signedMarker = '/object/sign/driver-documents/';
  const sIdx = value.indexOf(signedMarker);
  if (sIdx >= 0) return value.slice(sIdx + signedMarker.length).split('?')[0];
  return value;
}
