// Pure rules for client delivery alerts (texts and emails to the customer who
// booked the job). No network and no env reads, so every rule is unit-tested.
// The sender is lib/server/client-alerts.ts.
//
// Message rule (same as driver texts in lib/sms.ts): no street addresses, no
// names, and no medical details in any text. Cities, times and links only.

import { SMS_SITE_URL, cleanCity } from '@/lib/sms';

export type ClientAlertEvent = 'assigned' | 'picked_up' | 'delivered';

export const CLIENT_ALERT_EVENTS: ClientAlertEvent[] = ['assigned', 'picked_up', 'delivered'];

/** sms_log.kind for each client event (see migration 20261118000100). */
export const CLIENT_SMS_KIND = {
  assigned: 'client_assigned',
  picked_up: 'client_picked_up',
  delivered: 'client_delivered',
} as const;

export type ClientSmsKind = (typeof CLIENT_SMS_KIND)[ClientAlertEvent];

/** Consent line shown next to the client's "Text me delivery updates" switch. */
export const CLIENT_SMS_CONSENT_TEXT =
  'Text me when a driver is assigned, when my package is picked up, and when it is delivered. Msg and data rates may apply. Reply STOP to opt out.';

/**
 * Which alert the job's current status calls for. The alert is worked out
 * from the status saved in the database, never from the request, so a caller
 * cannot ask for a "delivered" text on a job that is still on the road.
 * A missed earlier alert is not sent late: once a job is picked up, only the
 * picked-up alert applies.
 */
export function clientEventForStatus(status: string | null | undefined): ClientAlertEvent | null {
  switch (status) {
    case 'assigned':
    case 'en_route_pickup':
    case 'arrived_pickup':
      return 'assigned';
    case 'picked_up':
    case 'en_route_delivery':
    case 'arrived_delivery':
      return 'picked_up';
    case 'delivered':
      return 'delivered';
    default:
      return null;
  }
}

/** Job sources Epyc books itself. Partner jobs (curri, walmart_spark, broker, other) never alert. */
const EPYC_SOURCES = ['direct', 'dispatch_app'];

/**
 * Only a real client account on a job Epyc booked gets alerts. Dispatch-made
 * jobs use the dispatcher as customer_id for now, and partner jobs may point
 * at a stand-in profile, so staff, drivers and partner jobs get nothing.
 */
export function shouldAlertClient(job: { source?: string | null }, profile: { role?: string | null }): boolean {
  if (!EPYC_SOURCES.includes(job.source ?? 'direct')) return false;
  return ['client', 'customer', 'member'].includes(profile.role ?? '');
}

/** Medical and HIPAA jobs never show photos on the public tracking page. */
export function hidesPhotosOnPublicPage(d: { is_medical?: boolean | null; is_hipaa?: boolean | null }): boolean {
  return d.is_medical === true || d.is_hipaa === true;
}

/** Short, safe job reference for a text: the tracking number if it looks plain. */
export function jobRef(trackingNumber: string | null | undefined, deliveryId: string): string {
  if (typeof trackingNumber === 'string' && /^[A-Za-z0-9-]{1,32}$/.test(trackingNumber)) return trackingNumber;
  return deliveryId.slice(0, 8).toUpperCase();
}

/** "2:41 PM" in Pacific time, or null for a missing or bad timestamp. */
export function formatPacificTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/** "Wed, Nov 18 at 2:41 PM" in Pacific time, for emails and the tracking page. */
export function formatPacificDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
  const time = formatPacificTime(iso);
  return time ? `${date} at ${time}` : date;
}

/** Where a client goes when there is no tracking link: their portal page. */
export function portalLink(deliveryId: string): string {
  return `${SMS_SITE_URL}/client/deliveries/${encodeURIComponent(deliveryId)}`;
}

export interface ClientAlertJob {
  id: string;
  tracking_number: string | null;
  pickup_city: string | null;
  delivery_city: string | null;
  actual_pickup_time: string | null;
  actual_delivery_time: string | null;
}

/** The text for one client alert. `link` is the tracking link or the portal link. */
export function clientAlertText(event: ClientAlertEvent, job: ClientAlertJob, link: string): string {
  const ref = jobRef(job.tracking_number, job.id);
  const from = cleanCity(job.pickup_city, 'pickup');
  const to = cleanCity(job.delivery_city, 'drop-off');
  switch (event) {
    case 'assigned':
      return `EPYC: A driver is assigned to your delivery ${ref} (${from} to ${to}). Track it: ${link}`;
    case 'picked_up': {
      const at = formatPacificTime(job.actual_pickup_time);
      return `EPYC: Your delivery ${ref} was picked up in ${from}${at ? ` at ${at}` : ''}. Photos and status: ${link}`;
    }
    case 'delivered': {
      const at = formatPacificTime(job.actual_delivery_time);
      return `EPYC: Your delivery ${ref} was delivered in ${to}${at ? ` at ${at}` : ''}. Proof of delivery: ${link}`;
    }
  }
}

export interface ClientAlertEmailInput {
  event: ClientAlertEvent;
  job: ClientAlertJob;
  link: string;
  firstName: string | null;
  /** Who signed or received it (delivered emails only). */
  receivedBy: string | null;
}

/** Subject line for one client alert email. */
export function clientAlertSubject(event: ClientAlertEvent, job: ClientAlertJob): string {
  const ref = jobRef(job.tracking_number, job.id);
  switch (event) {
    case 'assigned':
      return `A driver is assigned to your delivery ${ref}`;
    case 'picked_up':
      return `Your delivery ${ref} was picked up`;
    case 'delivered':
      return `Your delivery ${ref} was delivered`;
  }
}

/** Plain paragraphs for the email body; lib/email.ts wraps them in the brand shell. */
export function clientAlertParagraphs(input: ClientAlertEmailInput): string[] {
  const { event, job } = input;
  const ref = jobRef(job.tracking_number, job.id);
  const from = cleanCity(job.pickup_city, 'the pickup address');
  const to = cleanCity(job.delivery_city, 'the drop-off address');
  switch (event) {
    case 'assigned':
      return [
        `A driver is assigned to your delivery ${ref}, from ${from} to ${to}.`,
        'We will email you again when the package is picked up and when it is delivered.',
      ];
    case 'picked_up': {
      const at = formatPacificDateTime(job.actual_pickup_time);
      return [
        `Your delivery ${ref} was picked up in ${from}${at ? ` on ${at}` : ''} and is on its way to ${to}.`,
        'The tracking page shows the status and the pickup photos.',
      ];
    }
    case 'delivered': {
      const at = formatPacificDateTime(job.actual_delivery_time);
      const who = input.receivedBy ? ` It was received by ${input.receivedBy}.` : '';
      return [
        `Your delivery ${ref} was delivered in ${to}${at ? ` on ${at}` : ''}.${who}`,
        'The tracking page shows the drop-off photo and signature.',
      ];
    }
  }
}

/** Keep a recipient name short and printable before it goes in an email. */
export function cleanReceivedBy(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null;
  const n = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return n ? n.slice(0, 60) : null;
}

// --------------------------------------------
// Public tracking page (app/(marketing)/track/[id]/[sig])
// --------------------------------------------

export interface TrackingProofRow {
  type: string;
  stage: string | null;
  photo_kind: string | null;
  photo_url: string | null;
  signature_data: string | null;
  recipient_name: string | null;
}

export interface TrackingProofSelection {
  pickupPhotoPaths: string[];
  dropoffPhotoPaths: string[];
  signatureData: string | null;
  receivedBy: string | null;
}

/** Photos shown per section, at most. */
export const MAX_TRACKING_PHOTOS = 4;

/**
 * What the tracking page may show: pickup item photos (never receipts, which
 * can carry other customers' or billing details), drop-off placement photos
 * (never the recipient photo), the signature and who received it. Medical
 * and HIPAA jobs show no photos at all, since a label can carry patient data.
 */
export function selectTrackingProof(rows: TrackingProofRow[], hidePhotos: boolean): TrackingProofSelection {
  const photo = (stage: string, kind: string) =>
    rows
      .filter((r) => (r.stage ?? 'delivery') === stage && r.type === 'photo' && r.photo_kind === kind && r.photo_url)
      .map((r) => r.photo_url as string)
      .slice(0, MAX_TRACKING_PHOTOS);
  const delivery = rows.filter((r) => (r.stage ?? 'delivery') === 'delivery');
  return {
    pickupPhotoPaths: hidePhotos ? [] : photo('pickup', 'item'),
    dropoffPhotoPaths: hidePhotos ? [] : photo('delivery', 'placement'),
    signatureData: delivery.find((r) => r.type === 'signature' && r.signature_data)?.signature_data ?? null,
    receivedBy: cleanReceivedBy(delivery.find((r) => r.recipient_name)?.recipient_name ?? null),
  };
}

export interface TrackingStep {
  label: string;
  done: boolean;
  at: string | null;
}

/** The four steps the tracking page shows, with Pacific times where known. */
export function trackingSteps(d: {
  status: string;
  booked_at?: string | null;
  assigned_at?: string | null;
  actual_pickup_time?: string | null;
  actual_delivery_time?: string | null;
}): TrackingStep[] {
  const order = ['booked', 'assigned', 'picked_up', 'delivered'];
  const reached = (() => {
    const ev = clientEventForStatus(d.status);
    if (ev) return order.indexOf(ev);
    if (d.status === 'booked') return 0;
    return -1;
  })();
  return [
    { label: 'Booked', done: reached >= 0, at: formatPacificDateTime(d.booked_at) },
    { label: 'Driver assigned', done: reached >= 1, at: formatPacificDateTime(d.assigned_at) },
    { label: 'Picked up', done: reached >= 2, at: formatPacificDateTime(d.actual_pickup_time) },
    { label: 'Delivered', done: reached >= 3, at: formatPacificDateTime(d.actual_delivery_time) },
  ];
}

/** One plain headline for the job's status on the tracking page. */
export function trackingHeadline(status: string): string {
  switch (status) {
    case 'quote_requested':
    case 'quoted':
      return 'Waiting for booking';
    case 'booked':
      return 'Booked, waiting for a driver';
    case 'assigned':
    case 'en_route_pickup':
      return 'Driver on the way to pickup';
    case 'arrived_pickup':
      return 'Driver at pickup';
    case 'picked_up':
    case 'en_route_delivery':
      return 'Picked up, on the way';
    case 'arrived_delivery':
      return 'Driver at drop-off';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Delivery could not be completed. Call (818) 217-0070.';
    default:
      return 'In progress';
  }
}
