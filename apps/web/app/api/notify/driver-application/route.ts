import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  sendEmail,
  applicantAcknowledgement,
  opsNewApplicationAlert,
  OPS_INBOX,
} from '@/lib/email';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Fired right after a driver application is submitted.
 *
 * Sends two emails: an acknowledgement to the applicant so they are never left
 * guessing, and an alert to the ops inbox so the application is seen the same day.
 *
 * Deliberately never returns a failure that the caller would surface as a
 * submission error. The application itself is already saved; email is best effort.
 */

const schema = z.object({
  full_name: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(
    `notify-driver:${getClientIdentifier(request)}`,
    RATE_LIMITS.auth
  );
  if (!rate.success) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const fullName = payload.full_name?.trim() || null;
  const phone = payload.phone?.trim() || null;

  const ack = applicantAcknowledgement(fullName);
  const alert = opsNewApplicationAlert({ fullName, email: payload.email, phone });

  const [applicantResult, opsResult] = await Promise.all([
    sendEmail({
      to: payload.email,
      subject: ack.subject,
      html: ack.html,
      text: ack.text,
      replyTo: OPS_INBOX,
    }),
    sendEmail({
      to: OPS_INBOX,
      subject: alert.subject,
      html: alert.html,
      text: alert.text,
      replyTo: payload.email,
    }),
  ]);

  if (!applicantResult.sent || !opsResult.sent) {
    console.error('[notify/driver-application] delivery incomplete', {
      email: payload.email,
      applicant: applicantResult,
      ops: opsResult,
    });
  }

  return NextResponse.json({
    ok: true,
    applicant_notified: applicantResult.sent,
    ops_notified: opsResult.sent,
  });
}
