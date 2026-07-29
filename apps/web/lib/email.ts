/**
 * Transactional email for EPYC Courier Service.
 *
 * Uses Resend over plain fetch so the app takes no extra runtime dependency.
 * If RESEND_API_KEY is absent the helper degrades to a no-op that reports the
 * reason instead of throwing, so a missing key can never break a driver
 * application submission.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Where internal notifications land. */
export const OPS_INBOX = process.env.EPYC_OPS_EMAIL || 'admin@epyccs.com';

/** Verified sending identity. Must match a domain verified in Resend. */
export const MAIL_FROM =
  process.env.EPYC_MAIL_FROM || 'Epyc Courier Service <noreply@epyccs.com>';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: string;
  error?: string;
  id?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set - skipping send:', input.subject);
    return { sent: false, skipped: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[email] Resend rejected send:', res.status, detail);
      return { sent: false, error: `Resend ${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { sent: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

const BRAND_GREEN = '#1E9E4A';

function shell(bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;">
        <tr><td style="background:${BRAND_GREEN};padding:20px 28px;">
          <span style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:.4px;">EPYC COURIER SERVICE</span>
        </td></tr>
        <tr><td style="padding:28px;color:#26303d;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:18px 28px;background:#f7f8fa;color:#78838f;font-size:12px;line-height:1.5;">
          UDIG Solutions Inc. dba Epyc Courier Service<br>
          Los Angeles, CA &nbsp;|&nbsp; (818) 217-0070 &nbsp;|&nbsp; epyccs.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Acknowledgement sent to the applicant the moment they submit. */
export function applicantAcknowledgement(fullName: string | null) {
  const name = (fullName || '').trim().split(' ')[0] || 'there';

  const html = shell(`
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">We received your driver application and your documents came through. Thank you for applying to drive with Epyc.</p>
    <p style="margin:0 0 8px;font-weight:600;">What happens next</p>
    <ol style="margin:0 0 16px;padding-left:20px;">
      <li style="margin-bottom:6px;">A member of our team reviews your application and documents.</li>
      <li style="margin-bottom:6px;">We call you to confirm your vehicle, insurance, and availability.</li>
      <li style="margin-bottom:6px;">If it is a fit, we send a contractor agreement and a background check authorization.</li>
      <li>Once those clear, we assign your first route.</li>
    </ol>
    <p style="margin:0 0 14px;">You should hear from us within two business days. If you have not heard back by then, call or text Rico directly at
      <a href="tel:8182170070" style="color:${BRAND_GREEN};font-weight:600;text-decoration:none;">(818) 217-0070</a>.</p>
    <p style="margin:0;">Thanks for your interest,<br><strong>Epyc Courier Service</strong></p>
  `);

  const text = `Hi ${name},

We received your driver application and your documents came through. Thank you for applying to drive with Epyc.

What happens next:
1. A member of our team reviews your application and documents.
2. We call you to confirm your vehicle, insurance, and availability.
3. If it is a fit, we send a contractor agreement and a background check authorization.
4. Once those clear, we assign your first route.

You should hear from us within two business days. If you have not heard back by then, call or text Rico directly at (818) 217-0070.

Thanks for your interest,
Epyc Courier Service
UDIG Solutions Inc. dba Epyc Courier Service
Los Angeles, CA | (818) 217-0070 | epyccs.com`;

  return { subject: 'We received your Epyc driver application', html, text };
}

/** Internal alert so a new application never sits unseen again. */
export function opsNewApplicationAlert(a: {
  fullName: string | null;
  email: string;
  phone: string | null;
}) {
  const name = a.fullName?.trim() || '(no name given)';

  const html = shell(`
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;color:#78838f;font-weight:700;">NEW DRIVER APPLICATION</p>
    <p style="margin:0 0 18px;font-size:20px;font-weight:700;color:#0b1f3a;">${escapeHtml(name)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
      <tr><td style="padding:6px 0;color:#78838f;width:90px;">Phone</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(a.phone || 'not provided')}</td></tr>
      <tr><td style="padding:6px 0;color:#78838f;">Email</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(a.email)}</td></tr>
    </table>
    <p style="margin:18px 0 0;">Profile photo and both sides of the driver's license were uploaded. Review the application in the dispatch queue.</p>
    <p style="margin:14px 0 0;color:#78838f;font-size:13px;">Applicants who wait more than two days usually take other work. Call early.</p>
  `);

  const text = `NEW DRIVER APPLICATION

Name:  ${name}
Phone: ${a.phone || 'not provided'}
Email: ${a.email}

Profile photo and both sides of the driver's license were uploaded.
Review the application in the dispatch queue.

Applicants who wait more than two days usually take other work. Call early.`;

  return { subject: `New driver application: ${name}`, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
