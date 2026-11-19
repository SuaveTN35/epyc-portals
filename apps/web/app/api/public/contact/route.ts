import { NextRequest, NextResponse } from 'next/server';
import { contactMessageSchema, fieldErrors, CONTACT_SUBJECTS, labelFor } from '@/lib/public-requests';
import { createAdminClient } from '@/lib/server/supabase-admin';
import {
  sendEmail,
  OPS_INBOX,
  opsNewContactMessage,
  contactAcknowledgement,
  type ContactEmailData,
} from '@/lib/email';
import { getClientIdentifier } from '@/lib/rate-limit';
import { checkDurableRateLimit } from '@/lib/server/durable-rate-limit';
import { verifyTurnstile, tokenFrom } from '@/lib/server/turnstile';

/**
 * "Send us a message" on /contact. Replaces the old mailto: form, which only
 * worked when the visitor had a desktop mail program set up.
 *
 * Saves to contact_messages and emails the ops inbox (reply-to = the visitor).
 * Received if saved OR emailed; error only when both fail.
 */

const LIMIT = { limit: 5, windowSeconds: 600 };

export async function POST(request: NextRequest) {
  const rate = await checkDurableRateLimit(`contact:${getClientIdentifier(request)}`, LIMIT);
  if (!rate.success) {
    return NextResponse.json(
      { ok: false, error: 'Too many messages. Please wait a few minutes or call (818) 217-0070.' },
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

  const parsed = contactMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const m = parsed.data;

  if (m.website) {
    return NextResponse.json({ ok: true });
  }

  let saved = false;
  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.from('contact_messages').insert({
      full_name: m.full_name,
      email: m.email,
      phone: m.phone,
      subject: m.subject,
      message: m.message,
    });
    if (error) {
      console.error('[public/contact] save failed:', error.message);
    } else {
      saved = true;
    }
  } else {
    console.error('[public/contact] Supabase service role not configured');
  }

  const emailData: ContactEmailData = {
    fullName: m.full_name,
    email: m.email,
    phone: m.phone,
    subject: labelFor(CONTACT_SUBJECTS, m.subject),
    message: m.message,
    saved,
  };

  const alert = opsNewContactMessage(emailData);
  const opsResult = await sendEmail({
    to: OPS_INBOX,
    subject: alert.subject,
    html: alert.html,
    text: alert.text,
    replyTo: m.email,
  });

  if (!saved && !opsResult.sent) {
    console.error('[public/contact] not saved and not emailed', { ops: opsResult });
    return NextResponse.json(
      {
        ok: false,
        error: 'We could not send your message just now. Please call (818) 217-0070 or email admin@epyccs.com.',
      },
      { status: 503 }
    );
  }

  const ack = contactAcknowledgement(emailData);
  const ackResult = await sendEmail({
    to: m.email,
    subject: ack.subject,
    html: ack.html,
    text: ack.text,
    replyTo: OPS_INBOX,
  });

  return NextResponse.json({ ok: true, saved, ops_notified: opsResult.sent, customer_notified: ackResult.sent });
}
