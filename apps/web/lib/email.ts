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

/**
 * Acknowledgement sent to the applicant the moment they submit.
 * The route is public and this goes to the address the visitor typed, so it
 * carries fixed text only, no visitor input (same rule as the request and
 * contact acknowledgements).
 */
export function applicantAcknowledgement() {
  const html = shell(`
    <p style="margin:0 0 14px;">Hello,</p>
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

  const text = `Hello,

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
  /** Screening answers, already turned into readable labels. */
  answers?: Array<[string, string]>;
  hasResume?: boolean;
}) {
  const name = a.fullName?.trim() || '(no name given)';
  const answers = (a.answers || []).filter(([, v]) => v);
  const answerRows = answers
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#78838f;width:90px;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(v)}</td></tr>`
    )
    .join('');
  const answerText = answers.map(([k, v]) => `${(k + ':').padEnd(12)} ${v}`).join('\n');
  const resumeLine = a.hasResume ? 'A resume was attached.' : 'No resume attached.';

  const html = shell(`
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;color:#78838f;font-weight:700;">NEW DRIVER APPLICATION</p>
    <p style="margin:0 0 18px;font-size:20px;font-weight:700;color:#0b1f3a;">${escapeHtml(name)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
      <tr><td style="padding:6px 0;color:#78838f;width:90px;">Phone</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(a.phone || 'not provided')}</td></tr>
      <tr><td style="padding:6px 0;color:#78838f;">Email</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(a.email)}</td></tr>
      ${answerRows}
    </table>
    <p style="margin:18px 0 0;">Both sides of the driver's license were uploaded. ${resumeLine} Review the application in the dispatch queue.</p>
    <p style="margin:14px 0 0;color:#78838f;font-size:13px;">Applicants who wait more than two days usually take other work. Call early.</p>
  `);

  const text = `NEW DRIVER APPLICATION

Name:  ${name}
Phone: ${a.phone || 'not provided'}
Email: ${a.email}
${answerText ? answerText + '\n' : ''}
Both sides of the driver's license were uploaded. ${resumeLine}
Review the application in the dispatch queue.

Applicants who wait more than two days usually take other work. Call early.`;

  return { subject: `New driver application: ${oneLine(name)}`, html, text };
}

function detailTable(rows: Array<[string, string | null | undefined]>): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">${rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#78838f;width:110px;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600;white-space:pre-wrap;">${escapeHtml(String(v))}</td></tr>`
    )
    .join('')}</table>`;
}

function detailText(rows: Array<[string, string | null | undefined]>): string {
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${(k + ':').padEnd(14)} ${v}`)
    .join('\n');
}

export interface DeliveryRequestEmailData {
  reference: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  companyName: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  itemType: string;
  itemDescription: string | null;
  serviceLevel: string;
  pickupDate: string | null;
  timeWindow: string | null;
  notes: string | null;
  saved: boolean;
}

function deliveryRows(d: DeliveryRequestEmailData): Array<[string, string | null]> {
  return [
    ['Reference', d.reference],
    ['Name', d.contactName],
    ['Company', d.companyName],
    ['Phone', d.contactPhone],
    ['Email', d.contactEmail],
    ['Pickup', d.pickupAddress],
    ['Drop-off', d.dropoffAddress],
    ['Item', d.itemType],
    ['Description', d.itemDescription],
    ['When', d.serviceLevel],
    ['Date', d.pickupDate],
    ['Time window', d.timeWindow],
    ['Notes', d.notes],
  ];
}

/** Internal alert for a delivery request from the public site. */
export function opsNewDeliveryRequest(d: DeliveryRequestEmailData) {
  const savedNote = d.saved
    ? 'It is also in the dispatch portal under Requests.'
    : 'It could NOT be saved to the database, so this email is the only copy.';
  const html = shell(`
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;color:#78838f;font-weight:700;">NEW DELIVERY REQUEST</p>
    <p style="margin:0 0 18px;font-size:20px;font-weight:700;color:#0b1f3a;">${escapeHtml(d.contactName)}</p>
    ${detailTable(deliveryRows(d))}
    <p style="margin:18px 0 0;">Call the customer to confirm the price and book it. ${escapeHtml(savedNote)}</p>
  `);
  const text = `NEW DELIVERY REQUEST

${detailText(deliveryRows(d))}

Call the customer to confirm the price and book it. ${savedNote}`;
  return { subject: `Delivery request ${d.reference}: ${oneLine(d.contactName)}`, html, text };
}

/**
 * Acknowledgement to the person who asked for a delivery.
 *
 * Goes to whatever address the visitor typed, so it carries NO visitor free
 * text (name, addresses, notes, time window). Otherwise anyone could make
 * epyccs.com mail a stranger with words they chose. Only the server-made
 * reference and labels from fixed lists appear here.
 */
export function customerRequestAcknowledgement(d: DeliveryRequestEmailData) {
  const rows: Array<[string, string | null]> = [
    ['Reference', d.reference],
    ['Item', d.itemType],
    ['When', d.serviceLevel],
  ];
  const html = shell(`
    <p style="margin:0 0 14px;">Hello,</p>
    <p style="margin:0 0 14px;">Thanks for your delivery request. A dispatcher will call you shortly to confirm the price and pickup time. Nothing is booked or charged until you confirm.</p>
    ${detailTable(rows)}
    <p style="margin:18px 0 14px;">If it is urgent, call us at
      <a href="tel:8182170070" style="color:${BRAND_GREEN};font-weight:600;text-decoration:none;">(818) 217-0070</a> and give your reference.</p>
    <p style="margin:0;">Thank you,<br><strong>Epyc Courier Service</strong></p>
  `);
  const text = `Hello,

Thanks for your delivery request. A dispatcher will call you shortly to confirm the price and pickup time. Nothing is booked or charged until you confirm.

${detailText(rows)}

If it is urgent, call us at (818) 217-0070 and give your reference.

Thank you,
Epyc Courier Service
UDIG Solutions Inc. dba Epyc Courier Service
Los Angeles, CA | (818) 217-0070 | epyccs.com`;
  return { subject: `We received your delivery request (${d.reference})`, html, text };
}

export interface ContactEmailData {
  fullName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  saved: boolean;
}

/** Internal alert for a message from the /contact form. */
export function opsNewContactMessage(m: ContactEmailData) {
  const rows: Array<[string, string | null]> = [
    ['Name', m.fullName],
    ['Email', m.email],
    ['Phone', m.phone],
    ['Subject', m.subject],
    ['Message', m.message],
  ];
  const savedNote = m.saved
    ? 'It is also in the dispatch portal under Requests.'
    : 'It could NOT be saved to the database, so this email is the only copy.';
  const html = shell(`
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;color:#78838f;font-weight:700;">NEW WEBSITE MESSAGE</p>
    <p style="margin:0 0 18px;font-size:20px;font-weight:700;color:#0b1f3a;">${escapeHtml(m.fullName)}</p>
    ${detailTable(rows)}
    <p style="margin:18px 0 0;">Reply to this email to answer them directly. ${escapeHtml(savedNote)}</p>
  `);
  const text = `NEW WEBSITE MESSAGE

${detailText(rows)}

Reply to this email to answer them directly. ${savedNote}`;
  return { subject: `Website message (${oneLine(m.subject)}): ${oneLine(m.fullName)}`, html, text };
}

/**
 * Acknowledgement to the person who used the /contact form.
 * Fixed text only, no visitor input (see customerRequestAcknowledgement).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function contactAcknowledgement(_m: ContactEmailData) {
  const html = shell(`
    <p style="margin:0 0 14px;">Hello,</p>
    <p style="margin:0 0 14px;">Thanks for reaching out to Epyc Courier Service. We received your message and will get back to you soon.</p>
    <p style="margin:0 0 14px;">If you need a delivery right away, call us at
      <a href="tel:8182170070" style="color:${BRAND_GREEN};font-weight:600;text-decoration:none;">(818) 217-0070</a>.</p>
    <p style="margin:0;">Thank you,<br><strong>Epyc Courier Service</strong></p>
  `);
  const text = `Hello,

Thanks for reaching out to Epyc Courier Service. We received your message and will get back to you soon.

If you need a delivery right away, call us at (818) 217-0070.

Thank you,
Epyc Courier Service
UDIG Solutions Inc. dba Epyc Courier Service
Los Angeles, CA | (818) 217-0070 | epyccs.com`;
  return { subject: 'We received your message', html, text };
}

/** Collapse line breaks so visitor text can never split an email subject. */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
