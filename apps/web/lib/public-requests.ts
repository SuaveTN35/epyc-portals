/**
 * Public forms that work without an account: "Request a delivery" and
 * "Send us a message". Shared by the forms (labels, options) and the server
 * routes (validation), so both sides always agree.
 */
import { z } from 'zod';

export const ITEM_TYPES = [
  { value: 'medical', label: 'Medical (specimens, lab, pharmacy)' },
  { value: 'legal', label: 'Legal (court filings, documents)' },
  { value: 'commercial', label: 'Commercial (parts, supplies, packages)' },
  { value: 'other', label: 'Other' },
] as const;

export const SERVICE_LEVELS = [
  { value: 'asap', label: 'As soon as possible' },
  { value: 'same_day', label: 'Today, within a time window' },
  { value: 'scheduled', label: 'Scheduled for a later date' },
] as const;

export const CONTACT_SUBJECTS = [
  { value: 'quote', label: 'Request a Quote' },
  { value: 'delivery', label: 'Delivery Inquiry' },
  { value: 'account', label: 'Account Setup' },
  { value: 'support', label: 'Support' },
  { value: 'partnership', label: 'Business Partnership' },
  { value: 'driver', label: 'Driver Application' },
  { value: 'other', label: 'Other' },
] as const;

type Values<T extends readonly { value: string }[]> = T[number]['value'];
const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as [Values<T>, ...Values<T>[]];

export function labelFor(list: readonly { value: string; label: string }[], value: string | null | undefined): string {
  return list.find((o) => o.value === value)?.label ?? (value || '');
}

const required = (max: number, message: string) => z.string().trim().min(1, message).max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

// US phone: at least 10 digits once punctuation is removed.
const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a phone number with area code');

// Honeypot: a hidden field people never see. Bots fill it in.
const honeypot = z.string().max(500).optional().nullable();

export const deliveryRequestSchema = z
  .object({
    contact_name: required(120, 'Enter your name'),
    contact_phone: phone,
    contact_email: z.string().trim().email('Enter a valid email').max(320),
    company_name: optional(160),
    pickup_address: required(300, 'Enter the pickup address'),
    dropoff_address: required(300, 'Enter the drop-off address'),
    item_type: z.enum(values(ITEM_TYPES), { message: 'Choose what we are delivering' }),
    item_description: optional(500),
    service_level: z.enum(values(SERVICE_LEVELS)).default('same_day'),
    pickup_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    time_window: optional(120),
    notes: optional(2000),
    website: honeypot,
  })
  .superRefine((v, ctx) => {
    if (v.service_level === 'scheduled' && !v.pickup_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pickup_date'], message: 'Choose a pickup date' });
    }
  });

export type DeliveryRequestInput = z.input<typeof deliveryRequestSchema>;
export type DeliveryRequest = z.output<typeof deliveryRequestSchema>;

export const contactMessageSchema = z.object({
  full_name: required(120, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email').max(320),
  phone: optional(40),
  subject: z.enum(values(CONTACT_SUBJECTS)).default('other'),
  message: required(5000, 'Enter a message'),
  website: honeypot,
});

export type ContactMessageInput = z.input<typeof contactMessageSchema>;
export type ContactMessage = z.output<typeof contactMessageSchema>;

/** First error per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Short reference shown to the customer when the database did not save one. */
export function fallbackReference(): string {
  return 'REQ-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// Driver application screening answers (stored on driver_applications).
export const VAN_ACCESS = [
  { value: 'own_van', label: 'Yes, I own or lease a cargo van (Sprinter or similar)' },
  { value: 'can_rent_van', label: 'I can rent or borrow a cargo van' },
  { value: 'no_van', label: 'No cargo van (car, SUV, or pickup only)' },
] as const;

export const EXPERIENCE = [
  { value: 'none', label: 'No courier or delivery experience yet' },
  { value: 'under_1', label: 'Less than 1 year' },
  { value: '1_to_3', label: '1 to 3 years' },
  { value: 'over_3', label: 'More than 3 years' },
] as const;

export const AVAILABILITY = [
  { value: 'full_time', label: 'Full time (weekdays)' },
  { value: 'part_time', label: 'Part time' },
  { value: 'weekends', label: 'Weekends only' },
] as const;
