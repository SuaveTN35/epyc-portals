// Pure rules for the customer side of a delivery: what a customer may book,
// when they may cancel, which proof they may see, and how timeline events
// read. No Supabase calls here so every rule is unit-tested.

export const DISPATCH_PHONE = '(818) 217-0070';

/** Statuses a customer may cancel from (and only while no driver is set). */
export const CUSTOMER_CANCELLABLE_STATUSES = ['quote_requested', 'quoted', 'booked'] as const;

export const ALREADY_ASSIGNED_MESSAGE = `A driver is already on the way. Call ${DISPATCH_PHONE} to cancel.`;

export interface CancelTarget {
  customer_id: string;
  status: string;
  driver_id: string | null;
}

export type CancelDecision =
  | { ok: true }
  | { ok: false; httpStatus: 404 | 409; error: string };

export function canCustomerCancel(d: Pick<CancelTarget, 'status' | 'driver_id'>): boolean {
  return (
    (CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(d.status) && d.driver_id == null
  );
}

export function evaluateCustomerCancel(
  userId: string,
  delivery: CancelTarget | null
): CancelDecision {
  // Someone else's delivery reads as "not found" so ids cannot be probed.
  if (!delivery || delivery.customer_id !== userId) {
    return { ok: false, httpStatus: 404, error: 'Delivery not found' };
  }
  if (delivery.status === 'cancelled') {
    return { ok: false, httpStatus: 409, error: 'This delivery is already cancelled.' };
  }
  if (delivery.driver_id != null || !canCustomerCancel(delivery)) {
    if (['delivered', 'failed'].includes(delivery.status)) {
      return { ok: false, httpStatus: 409, error: 'This delivery is already finished.' };
    }
    return { ok: false, httpStatus: 409, error: ALREADY_ASSIGNED_MESSAGE };
  }
  return { ok: true };
}

// --------------------------------------------
// Proof a customer may see
// --------------------------------------------

export interface ProofRow {
  type: string;
  stage: string | null;
  photo_kind: string | null;
  photo_url: string | null;
  signature_data: string | null;
  recipient_name: string | null;
  recipient_relation: string | null;
  notes: string | null;
  captured_at: string | null;
}

export interface CustomerProofSelection {
  placementPaths: string[];
  signatureData: string | null;
  recipientName: string | null;
  recipientRelation: string | null;
  notes: string[];
  capturedAt: string | null;
}

/**
 * Customers see where the package was left and the signature. Never the
 * recipient photo (a stranger's face) and never anything from pickup (item
 * photos and receipts belong to the shipper side and dispatch).
 */
export function selectCustomerProof(rows: ProofRow[]): CustomerProofSelection {
  const delivery = rows.filter((r) => (r.stage ?? 'delivery') === 'delivery');
  const placementPaths = delivery
    .filter((r) => r.type === 'photo' && r.photo_kind === 'placement' && r.photo_url)
    .map((r) => r.photo_url as string);
  const signature = delivery.find((r) => r.type === 'signature' && r.signature_data);
  const named = delivery.find((r) => r.recipient_name);
  const related = delivery.find((r) => r.recipient_relation);
  const notes = delivery
    .filter((r) => r.type !== 'temperature')
    .map((r) => r.notes)
    .filter((n): n is string => !!n && n.trim().length > 0);
  const times = delivery.map((r) => r.captured_at).filter((t): t is string => !!t).sort();
  return {
    placementPaths,
    signatureData: signature?.signature_data ?? null,
    recipientName: named?.recipient_name ?? null,
    recipientRelation: related?.recipient_relation ?? null,
    notes,
    capturedAt: times.length ? times[times.length - 1] : null,
  };
}

/** Only inline image data is passed through as a signature. */
export function isSafeSignatureData(value: string | null): value is string {
  return !!value && /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value);
}

// --------------------------------------------
// Timeline events
// --------------------------------------------

export interface TimelineEvent {
  event_type: string;
  old_status?: string | null;
  new_status?: string | null;
  notes?: string | null;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  status_change: 'Status updated',
  driver_assigned: 'Driver assigned',
  driver_released: 'Driver released the job',
  pickup_completed: 'Picked up',
  delivery_completed: 'Delivered',
  delivery_failed: 'Delivery failed',
  delivery_cancelled: 'Delivery cancelled',
  customer_cancelled: 'You cancelled this delivery',
  payment_received: 'Payment received',
  payment_failed: 'Payment failed',
  payment_refunded: 'Payment refunded',
  note_added: 'Note added',
};

function humanize(value: string): string {
  const s = value.replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Update';
}

/** The headline for one timeline row, from live columns only. */
export function eventHeadline(e: TimelineEvent): string {
  return EVENT_TYPE_LABELS[e.event_type] ?? humanize(e.event_type || 'update');
}

/**
 * Dispatch and driver bookkeeping the customer should not see at all
 * (driver problem reports, offer traffic, hand-backs, intake source).
 */
const INTERNAL_EVENT_TYPES = new Set([
  'exception',
  'exception_resolved',
  'offer_sent',
  'offer_accepted',
  'offer_rejected',
  'driver_released',
  'created_by_dispatch',
  'broker_created',
]);

/** Event types whose notes were written for the customer to read. */
const CUSTOMER_NOTE_TYPES = new Set([
  'customer_cancelled',
  'payment_received',
  'payment_failed',
  'payment_refunded',
]);

export function isCustomerVisibleEvent(e: TimelineEvent): boolean {
  return !INTERNAL_EVENT_TYPES.has(e.event_type);
}

/** Free-text detail, if any, and only where the note is customer-facing. */
export function eventDetail(e: TimelineEvent): string | null {
  if (!CUSTOMER_NOTE_TYPES.has(e.event_type)) return null;
  const n = e.notes?.trim();
  return n ? n : null;
}

// --------------------------------------------
// Payments
// --------------------------------------------

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

const PAYMENT_RANK: Record<PaymentStatus, number> = {
  pending: 0,
  processing: 1,
  failed: 2,
  succeeded: 3,
  refunded: 4,
};

/**
 * Stripe can deliver webhooks out of order or more than once. Returns the
 * status to write, or null when the incoming one should not overwrite the
 * current one (same status, or a step backward such as succeeded after
 * refunded). A failed attempt may be followed by a later success.
 */
export function nextPaymentStatus(
  current: PaymentStatus | null,
  incoming: PaymentStatus
): PaymentStatus | null {
  if (current === incoming) return null;
  if (current == null) return incoming;
  if (current === 'refunded') return null;
  if (incoming === 'failed' && current === 'succeeded') return null;
  if (PAYMENT_RANK[incoming] < PAYMENT_RANK[current] && current !== 'failed') return null;
  return incoming;
}

/** Amount in cents a delivery should be charged, from its stored total. */
export function chargeCents(totalPrice: number | string | null | undefined): number | null {
  const n = typeof totalPrice === 'string' ? Number(totalPrice) : totalPrice;
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
