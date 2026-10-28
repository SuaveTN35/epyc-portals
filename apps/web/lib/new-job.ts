// Dispatch "New Job" form: field model, validation, and the deliveries row it
// produces. Kept free of React and Supabase so it can be unit tested.
//
// Live column notes (packages/supabase/LIVE-SCHEMA-SNAPSHOT-2026-10-27.md):
// - deliveries.customer_id is NOT NULL. Until there is a customer picker,
//   staff-created jobs use the creating staff user's id (agreed interim).
// - There is no pieces / pallet column, so the count is folded into
//   package_description.
// - source / source_reference come from migration 20261028000000_phase2_jobs.
// - This form never sets is_hipaa or is_medical. Medical jobs with patient
//   data are out of scope for manual entry.

import { GEAR_IDS } from './driver-profile-items';
import type { ServiceLevel, VehicleType } from '@epyc/shared';

export const JOB_SOURCES = [
  { value: 'direct', label: 'Direct' },
  { value: 'curri', label: 'Curri' },
  { value: 'walmart_spark', label: 'Walmart Spark' },
  { value: 'dispatch_app', label: 'Dispatch app' },
  { value: 'broker', label: 'Broker' },
  { value: 'other', label: 'Other' },
] as const;

export type JobSource = (typeof JOB_SOURCES)[number]['value'];

export function jobSourceLabel(value: string | null | undefined): string {
  if (!value) return 'Direct';
  return JOB_SOURCES.find((s) => s.value === value)?.label ?? value;
}

export const SERVICE_LEVELS: ServiceLevel[] = ['standard', 'priority', 'rush', 'scheduled'];
export const VEHICLE_TYPES: VehicleType[] = ['car', 'suv', 'van', 'truck', 'box_truck'];

export interface NewJobForm {
  source: JobSource;
  source_reference: string;

  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions: string;
  pickup_window_start: string; // datetime-local value, '' when blank
  pickup_window_end: string;

  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  delivery_instructions: string;
  delivery_window_start: string;
  delivery_window_end: string;

  package_description: string;
  package_weight: string;
  pieces: string;

  service_level: ServiceLevel;
  vehicle_required: VehicleType;
  requires_signature: boolean;
  requires_photo_pod: boolean;
  loading_required: boolean;
  /** P-366 / TRIBUNAL R12: gear this job needs (gear ids). Shown on the offer; never a block. */
  required_equipment: string[];

  total_price: string;
  driver_payout: string;
}

export const EMPTY_NEW_JOB: NewJobForm = {
  source: 'direct',
  source_reference: '',
  pickup_address: '',
  pickup_city: '',
  pickup_state: 'CA',
  pickup_zip: '',
  pickup_contact_name: '',
  pickup_contact_phone: '',
  pickup_instructions: '',
  pickup_window_start: '',
  pickup_window_end: '',
  delivery_address: '',
  delivery_city: '',
  delivery_state: 'CA',
  delivery_zip: '',
  delivery_contact_name: '',
  delivery_contact_phone: '',
  delivery_instructions: '',
  delivery_window_start: '',
  delivery_window_end: '',
  package_description: '',
  package_weight: '',
  pieces: '',
  service_level: 'standard',
  vehicle_required: 'car',
  requires_signature: true,
  requires_photo_pod: true,
  loading_required: false,
  required_equipment: [],
  total_price: '',
  driver_payout: '',
};

export type NewJobErrors = Partial<Record<keyof NewJobForm, string>>;

const REQUIRED: Array<[keyof NewJobForm, string]> = [
  ['pickup_address', 'Pickup address is required'],
  ['pickup_city', 'Pickup city is required'],
  ['pickup_state', 'Pickup state is required'],
  ['pickup_zip', 'Pickup ZIP is required'],
  ['delivery_address', 'Delivery address is required'],
  ['delivery_city', 'Delivery city is required'],
  ['delivery_state', 'Delivery state is required'],
  ['delivery_zip', 'Delivery ZIP is required'],
  ['package_description', 'Package description is required'],
  ['total_price', 'Job price is required'],
  ['driver_payout', 'Driver payout is required'],
];

function trimOrNull(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

function toIsoOrNull(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseMoney(v: string): number | null {
  const t = v.trim().replace(/^\$/, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function validateNewJob(form: NewJobForm): NewJobErrors {
  const errors: NewJobErrors = {};

  for (const [key, message] of REQUIRED) {
    const value = form[key];
    if (typeof value === 'string' && value.trim() === '') {
      errors[key] = message;
    }
  }

  if (!JOB_SOURCES.some((s) => s.value === form.source)) {
    errors.source = 'Choose a job source';
  }
  // Platform jobs need their reference so payouts can be reconciled.
  if (form.source !== 'direct' && form.source !== 'other' && form.source_reference.trim() === '') {
    errors.source_reference = 'Enter the job or order number from this source';
  }
  if (!SERVICE_LEVELS.includes(form.service_level)) {
    errors.service_level = 'Choose a service level';
  }
  if (!VEHICLE_TYPES.includes(form.vehicle_required)) {
    errors.vehicle_required = 'Choose a vehicle';
  }

  for (const key of ['pickup_zip', 'delivery_zip'] as const) {
    if (!errors[key] && !/^\d{5}(-\d{4})?$/.test(form[key].trim())) {
      errors[key] = 'Enter a 5-digit ZIP';
    }
  }
  for (const key of ['pickup_state', 'delivery_state'] as const) {
    if (!errors[key] && !/^[A-Za-z]{2}$/.test(form[key].trim())) {
      errors[key] = 'Use the 2-letter state code';
    }
  }

  const price = parseMoney(form.total_price);
  const payout = parseMoney(form.driver_payout);
  if (!errors.total_price && (price === null || Number.isNaN(price) || price <= 0)) {
    errors.total_price = 'Enter a price greater than 0';
  }
  if (!errors.driver_payout && (payout === null || Number.isNaN(payout) || payout < 0)) {
    errors.driver_payout = 'Enter a payout of 0 or more';
  }
  if (
    !errors.total_price &&
    !errors.driver_payout &&
    price !== null &&
    payout !== null &&
    payout > price
  ) {
    errors.driver_payout = 'Driver payout cannot be more than the job price';
  }

  if (form.package_weight.trim() !== '') {
    const w = Number(form.package_weight);
    if (!Number.isFinite(w) || w <= 0) errors.package_weight = 'Weight must be a positive number';
  }
  if (form.pieces.trim() !== '') {
    const p = Number(form.pieces);
    if (!Number.isInteger(p) || p <= 0) errors.pieces = 'Pieces must be a whole number';
  }

  const windows: Array<[keyof NewJobForm, keyof NewJobForm]> = [
    ['pickup_window_start', 'pickup_window_end'],
    ['delivery_window_start', 'delivery_window_end'],
  ];
  for (const [startKey, endKey] of windows) {
    const start = toIsoOrNull(form[startKey] as string);
    const end = toIsoOrNull(form[endKey] as string);
    if (start && end && new Date(end) < new Date(start)) {
      errors[endKey] = 'Window end must be after the start';
    }
  }

  return errors;
}

export function packageDescriptionWithPieces(description: string, pieces: string): string {
  const desc = description.trim();
  const count = pieces.trim();
  if (!count) return desc;
  const label = Number(count) === 1 ? 'piece' : 'pieces';
  return `${desc} (${count} ${label})`;
}

/**
 * Builds the deliveries INSERT payload. Call validateNewJob first; this
 * assumes a valid form.
 */
export function buildNewJobRow(
  form: NewJobForm,
  staffUserId: string,
  trackingNumber: string,
  now: Date = new Date()
) {
  const weight = form.package_weight.trim() === '' ? null : Number(form.package_weight);
  return {
    tracking_number: trackingNumber,
    customer_id: staffUserId,
    status: 'booked' as const,
    booked_at: now.toISOString(),
    source: form.source,
    source_reference: trimOrNull(form.source_reference),

    pickup_address: form.pickup_address.trim(),
    pickup_city: form.pickup_city.trim(),
    pickup_state: form.pickup_state.trim().toUpperCase(),
    pickup_zip: form.pickup_zip.trim(),
    pickup_contact_name: trimOrNull(form.pickup_contact_name),
    pickup_contact_phone: trimOrNull(form.pickup_contact_phone),
    pickup_instructions: trimOrNull(form.pickup_instructions),
    pickup_window_start: toIsoOrNull(form.pickup_window_start),
    pickup_window_end: toIsoOrNull(form.pickup_window_end),

    delivery_address: form.delivery_address.trim(),
    delivery_city: form.delivery_city.trim(),
    delivery_state: form.delivery_state.trim().toUpperCase(),
    delivery_zip: form.delivery_zip.trim(),
    delivery_contact_name: trimOrNull(form.delivery_contact_name),
    delivery_contact_phone: trimOrNull(form.delivery_contact_phone),
    delivery_instructions: trimOrNull(form.delivery_instructions),
    delivery_window_start: toIsoOrNull(form.delivery_window_start),
    delivery_window_end: toIsoOrNull(form.delivery_window_end),

    package_description: packageDescriptionWithPieces(form.package_description, form.pieces),
    package_weight: weight,

    service_level: form.service_level,
    vehicle_required: form.vehicle_required,
    requires_signature: form.requires_signature,
    requires_photo_pod: form.requires_photo_pod,
    loading_required: form.loading_required,
    required_equipment: GEAR_IDS.filter((id) => form.required_equipment.includes(id)),
    is_hipaa: false,
    is_medical: false,

    total_price: parseMoney(form.total_price),
    driver_payout: parseMoney(form.driver_payout),
  };
}
