import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  sendEmail,
  applicantAcknowledgement,
  opsNewApplicationAlert,
  OPS_INBOX,
} from '@/lib/email';
import { getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { checkDurableRateLimit } from '@/lib/server/durable-rate-limit';
import { VAN_ACCESS, EXPERIENCE, AVAILABILITY, labelFor } from '@/lib/public-requests';

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
  van_access: z.string().max(40).nullable().optional(),
  years_experience: z.string().max(40).nullable().optional(),
  availability: z.string().max(40).nullable().optional(),
  has_resume: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const rate = await checkDurableRateLimit(
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

  const ack = applicantAcknowledgement();
  // Only known answers become labels; anything else is dropped.
  const known = (list: readonly { value: string; label: string }[], v?: string | null) =>
    list.some((o) => o.value === v) ? labelFor(list, v) : '';
  const alert = opsNewApplicationAlert({
    fullName,
    email: payload.email,
    phone,
    answers: [
      ['Cargo van', known(VAN_ACCESS, payload.van_access)],
      ['Experience', known(EXPERIENCE, payload.years_experience)],
      ['Availability', known(AVAILABILITY, payload.availability)],
    ],
    hasResume: payload.has_resume === true,
  });

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
