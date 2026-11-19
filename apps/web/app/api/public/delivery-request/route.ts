import { NextRequest, NextResponse } from 'next/server';
import {
  deliveryRequestSchema,
  fieldErrors,
  fallbackReference,
  ITEM_TYPES,
  SERVICE_LEVELS,
  labelFor,
} from '@/lib/public-requests';
import { createAdminClient } from '@/lib/server/supabase-admin';
import {
  sendEmail,
  OPS_INBOX,
  opsNewDeliveryRequest,
  customerRequestAcknowledgement,
  type DeliveryRequestEmailData,
} from '@/lib/email';
import { getClientIdentifier } from '@/lib/rate-limit';
import { checkDurableRateLimit } from '@/lib/server/durable-rate-limit';
import { verifyTurnstile, tokenFrom } from '@/lib/server/turnstile';

/**
 * "Request a delivery" from the public site, no account needed.
 *
 * Saves the request to delivery_requests (service role) and emails the ops
 * inbox plus an acknowledgement to the customer. The request counts as
 * received if it was saved OR the ops email went out; only when both fail does
 * the visitor see an error (with the phone number to call).
 */

// 5 requests per 10 minutes per IP is plenty for a person, too few for a bot.
const LIMIT = { limit: 5, windowSeconds: 600 };

export async function POST(request: NextRequest) {
  const rate = await checkDurableRateLimit(`delivery-request:${getClientIdentifier(request)}`, LIMIT);
  if (!rate.success) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Please wait a few minutes or call (818) 217-0070.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const human = await verifyTurnstile(tokenFrom(body), getClientIdentifier(request));
  if (!human.ok) {
    return NextResponse.json(
      { ok: false, error: 'Please complete the security check and try again, or call (818) 217-0070.', captcha: true },
      { status: 403 }
    );
  }

  const parsed = deliveryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const r = parsed.data;

  // Honeypot filled in: answer like a success so the bot moves on, store nothing.
  if (r.website) {
    return NextResponse.json({ ok: true, reference: fallbackReference() });
  }

  let reference: string | null = null;
  const admin = createAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from('delivery_requests')
      .insert({
        contact_name: r.contact_name,
        contact_phone: r.contact_phone,
        contact_email: r.contact_email,
        company_name: r.company_name,
        pickup_address: r.pickup_address,
        dropoff_address: r.dropoff_address,
        item_type: r.item_type,
        item_description: r.item_description,
        service_level: r.service_level,
        pickup_date: r.pickup_date || null,
        time_window: r.time_window,
        notes: r.notes,
      })
      .select('reference')
      .single();
    if (error) {
      console.error('[public/delivery-request] save failed:', error.message);
    } else {
      reference = data?.reference ?? null;
    }
  } else {
    console.error('[public/delivery-request] Supabase service role not configured');
  }

  const saved = reference !== null;
  const emailData: DeliveryRequestEmailData = {
    reference: reference ?? fallbackReference(),
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    contactEmail: r.contact_email,
    companyName: r.company_name,
    pickupAddress: r.pickup_address,
    dropoffAddress: r.dropoff_address,
    itemType: labelFor(ITEM_TYPES, r.item_type),
    itemDescription: r.item_description,
    serviceLevel: labelFor(SERVICE_LEVELS, r.service_level),
    pickupDate: r.pickup_date || null,
    timeWindow: r.time_window,
    notes: r.notes,
    saved,
  };

  const alert = opsNewDeliveryRequest(emailData);
  const opsResult = await sendEmail({
    to: OPS_INBOX,
    subject: alert.subject,
    html: alert.html,
    text: alert.text,
    replyTo: r.contact_email,
  });

  if (!saved && !opsResult.sent) {
    console.error('[public/delivery-request] not saved and not emailed', { ops: opsResult });
    return NextResponse.json(
      {
        ok: false,
        error: 'We could not send your request just now. Please call (818) 217-0070 and we will book it by phone.',
      },
      { status: 503 }
    );
  }

  // Acknowledge only once the request is actually somewhere we will see it.
  const ack = customerRequestAcknowledgement(emailData);
  const ackResult = await sendEmail({
    to: r.contact_email,
    subject: ack.subject,
    html: ack.html,
    text: ack.text,
    replyTo: OPS_INBOX,
  });

  return NextResponse.json({
    ok: true,
    reference: emailData.reference,
    saved,
    ops_notified: opsResult.sent,
    customer_notified: ackResult.sent,
  });
}
