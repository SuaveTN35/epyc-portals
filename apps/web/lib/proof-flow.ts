// Driver pickup-to-drop-off proof flow: step model, validation, and the
// proof_of_delivery rows each screen saves. Pure functions so they are unit
// tested; the database enforces the same rules in the trigger
// guard_delivery_driver_update (migration 20261028000000_phase2_jobs.sql).
// Keep the two in step.

export const DRIVER_FLOW = [
  'assigned',
  'en_route_pickup',
  'arrived_pickup',
  'picked_up',
  'en_route_delivery',
  'arrived_delivery',
  'delivered',
] as const;

export type DriverFlowStatus = (typeof DRIVER_FLOW)[number];

const SKIPPABLE = new Set<string>(['en_route_pickup', 'en_route_delivery']);

/** Mirrors the trigger: forward only, en_route_* may be skipped, failed from any active step. */
export function canDriverMoveTo(from: string, to: string): boolean {
  if (from === to) return false;
  if (to === 'failed') {
    return DRIVER_FLOW.slice(0, 6).includes(from as DriverFlowStatus);
  }
  const a = DRIVER_FLOW.indexOf(from as DriverFlowStatus);
  const b = DRIVER_FLOW.indexOf(to as DriverFlowStatus);
  if (a < 0 || b < 0 || b <= a) return false;
  for (let i = a + 1; i < b; i++) {
    if (!SKIPPABLE.has(DRIVER_FLOW[i])) return false;
  }
  return true;
}

export type DriverStep = 'to_pickup' | 'pickup_proof' | 'to_dropoff' | 'dropoff_proof' | 'done';

export function driverStepFor(status: string): DriverStep {
  switch (status) {
    case 'assigned':
    case 'en_route_pickup':
      return 'to_pickup';
    case 'arrived_pickup':
      return 'pickup_proof';
    case 'picked_up':
    case 'en_route_delivery':
      return 'to_dropoff';
    case 'arrived_delivery':
      return 'dropoff_proof';
    default:
      return 'done';
  }
}

export const MAX_ITEM_PHOTOS = 4;
export const MAX_PLACEMENT_PHOTOS = 4;
export const MAX_RECIPIENT_PHOTOS = 2;

/** Stored at the start of notes; the trigger matches it case-insensitively. */
export const LEFT_WITHOUT_SIGNATURE_PREFIX = 'Left without signature:';
export const NO_RECEIPT_PREFIX = 'No receipt given:';

export const LEFT_WITH_OPTIONS = [
  { value: 'recipient', label: 'Recipient in person' },
  { value: 'front_desk', label: 'Front desk / reception' },
  { value: 'mailroom', label: 'Mailroom' },
  { value: 'front_door', label: 'Front door' },
  { value: 'back_door', label: 'Back door' },
  { value: 'loading_dock', label: 'Loading dock' },
  { value: 'other', label: 'Other' },
] as const;

export type LeftWith = (typeof LEFT_WITH_OPTIONS)[number]['value'];

export function leftWithLabel(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  return LEFT_WITH_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export type PhotoKind = 'item' | 'receipt' | 'placement' | 'recipient' | 'other';

export function proofPhotoPath(
  deliveryId: string,
  stage: 'pickup' | 'delivery',
  kind: PhotoKind,
  ts: number = Date.now()
): string {
  // First folder must be the delivery id: the storage policy checks it.
  return `${deliveryId}/${stage}-${kind}-${ts}-${Math.random().toString(36).slice(2, 6)}.jpg`;
}

/**
 * A stored proof photo path must sit directly under the delivery's own
 * folder: "<delivery_id>/<file>". One segment after the id, safe characters
 * only, no "..", no URL. The database enforces the same rule for non-staff
 * inserts in trigger guard_proof_photo_path (migration
 * 20261028000400_p358_price_integrity.sql). Keep the two in step.
 */
export const PROOF_FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export function isProofPathForDelivery(deliveryId: string, path: string | null | undefined): boolean {
  if (typeof path !== 'string' || typeof deliveryId !== 'string' || !deliveryId) return false;
  const prefix = `${deliveryId.toLowerCase()}/`;
  if (!path.startsWith(prefix)) return false;
  const file = path.slice(prefix.length);
  return PROOF_FILE_NAME_RE.test(file) && !file.includes('..');
}

export interface Gps {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------- pickup

export interface PickupProofInput {
  itemPhotos: string[];
  receiptPhotos: string[];
  noReceipt: boolean;
  note: string;
}

export function validatePickupProof(p: PickupProofInput): string | null {
  if (p.itemPhotos.length < 1) return 'Take at least one photo of the item(s).';
  if (p.itemPhotos.length > MAX_ITEM_PHOTOS) return `Up to ${MAX_ITEM_PHOTOS} item photos.`;
  if (p.noReceipt) {
    if (p.note.trim().length < 3) return 'No receipt: add a short note explaining why.';
  } else if (p.receiptPhotos.length < 1) {
    return 'Take a photo of the receipt or bill of lading, or tick "No receipt given".';
  }
  return null;
}

export function buildPickupProofRows(
  deliveryId: string,
  p: PickupProofInput,
  gps: Gps | null,
  capturedAt: string
) {
  const base = {
    delivery_id: deliveryId,
    type: 'photo' as const,
    stage: 'pickup' as const,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    captured_at: capturedAt,
  };
  const trimmed = p.note.trim();
  const note = p.noReceipt ? `${NO_RECEIPT_PREFIX} ${trimmed}` : trimmed || null;
  const rows = p.itemPhotos.map((path, i) => ({
    ...base,
    photo_kind: 'item' as PhotoKind,
    photo_url: path,
    // The note rides on the first item photo row.
    notes: i === 0 ? note : null,
  }));
  if (!p.noReceipt) {
    for (const path of p.receiptPhotos) {
      rows.push({ ...base, photo_kind: 'receipt', photo_url: path, notes: null });
    }
  }
  return rows;
}

// ---------------------------------------------------------------- drop-off

export interface DropoffProofInput {
  recipientName: string;
  leftWith: LeftWith | '';
  note: string;
  placementPhotos: string[];
  recipientPhotos: string[];
  signature: string | null;
  requiresSignature: boolean;
  noSignature: boolean;
}

export function validateDropoffProof(p: DropoffProofInput): string | null {
  if (!p.recipientName.trim()) return 'Enter the recipient name.';
  if (!p.leftWith) return 'Choose where or with whom it was left.';
  if (p.placementPhotos.length < 1) return 'Take a photo showing where it was left.';
  if (p.noSignature) {
    if (p.note.trim().length < 3) return 'Left without signature: add a short note explaining why.';
  } else if (p.requiresSignature && !p.signature) {
    return 'This delivery needs a signature, or choose "Left without signature".';
  }
  return null;
}

export function buildDropoffProofRows(
  deliveryId: string,
  p: DropoffProofInput,
  gps: Gps | null,
  capturedAt: string
) {
  const name = p.recipientName.trim();
  const relation = p.leftWith || null;
  const trimmed = p.note.trim();
  const note = p.noSignature ? `${LEFT_WITHOUT_SIGNATURE_PREFIX} ${trimmed}` : trimmed || null;
  const base = {
    delivery_id: deliveryId,
    stage: 'delivery' as const,
    recipient_name: name,
    recipient_relation: relation,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    captured_at: capturedAt,
  };

  const rows: Array<Record<string, unknown>> = p.placementPhotos.map((path, i) => ({
    ...base,
    type: 'photo',
    photo_kind: 'placement',
    photo_url: path,
    notes: i === 0 ? note : null,
  }));
  for (const path of p.recipientPhotos) {
    rows.push({ ...base, type: 'photo', photo_kind: 'recipient', photo_url: path, notes: null });
  }
  if (p.signature && !p.noSignature) {
    rows.push({
      ...base,
      type: 'signature',
      photo_kind: null,
      signature_data: p.signature,
      notes: null,
    });
  }
  return rows;
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ---------------------------------------------------------------- checklists

export const PHOTO_GUIDANCE =
  'Make sure items and labels are fully visible. Do not include people in the photo.';

export interface ChecklistItem {
  label: string;
  done: boolean;
}

function reached(status: string, target: DriverFlowStatus): boolean {
  const a = DRIVER_FLOW.indexOf(status as DriverFlowStatus);
  return a >= 0 && a >= DRIVER_FLOW.indexOf(target);
}

/**
 * Pickup steps. Status decides Arrive and Pickup complete; the live flags
 * (photos taken on this screen) tick the middle steps before submit. Once
 * the pickup is complete every step is done.
 */
export function pickupChecklist(
  status: string,
  live: { itemPhotos?: number; receiptOrNote?: boolean } = {}
): ChecklistItem[] {
  const complete = reached(status, 'picked_up');
  return [
    { label: 'Arrive', done: reached(status, 'arrived_pickup') },
    { label: 'Photo of items', done: complete || (live.itemPhotos ?? 0) > 0 },
    { label: 'Receipt / BOL', done: complete || !!live.receiptOrNote },
    { label: 'Pickup complete', done: complete },
  ];
}

export function dropoffChecklist(
  status: string,
  live: { placementPhotos?: number; recipientAndSignature?: boolean } = {}
): ChecklistItem[] {
  const complete = reached(status, 'delivered');
  return [
    { label: 'Arrive', done: reached(status, 'arrived_delivery') },
    { label: 'Photo of where left', done: complete || (live.placementPhotos ?? 0) > 0 },
    { label: 'Recipient name + signature', done: complete || !!live.recipientAndSignature },
    { label: 'Complete', done: complete },
  ];
}
