'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import Turnstile, { TURNSTILE_SITE_KEY } from '@/components/public/Turnstile';
import { CONTACT_SUBJECTS } from '@/lib/public-requests';

const inputClass =
  'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary';

const EMPTY = { full_name: '', phone: '', email: '', subject: 'quote', message: '', website: '' };
type Field = keyof typeof EMPTY;

/** /contact "Send us a message" form. Posts to /api/public/contact. */
export default function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const [sent, setSent] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // After a failed send, move focus to the first field with a problem, or to
  // the error message. After a successful send, move focus to the confirmation.
  useEffect(() => {
    if (!formError) return;
    const bad = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (bad || alertRef.current)?.focus();
  }, [formError, errors]);
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  const set = (name: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    if (errors[name]) setErrors((x) => ({ ...x, [name]: '' }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setErrors({});
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstile_token: captcha }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fields?: Record<string, string>;
      };
      if (res.ok && data.ok) {
        setSent(true);
        setForm(EMPTY);
      } else {
        setErrors(data.fields || {});
        setFormError(data.error || 'Something went wrong. Please call (818) 217-0070.');
      }
    } catch {
      setFormError('Could not connect. Check your signal and try again, or call (818) 217-0070.');
    } finally {
      setLoading(false);
      // Turnstile tokens are single use; get a fresh one for the next try.
      setCaptcha(null);
      setCaptchaRound((n) => n + 1);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-10" role="status">
        <CheckCircle className="h-12 w-12 text-epyc-primary mx-auto mb-4" aria-hidden="true" />
        <h3 ref={doneRef} tabIndex={-1} className="text-xl font-bold text-gray-900 mb-2 focus:outline-none">
          Message sent
        </h3>
        <p className="text-gray-600 mb-6">Thanks for reaching out. We will get back to you soon.</p>
        <button type="button" onClick={() => setSent(false)} className="btn btn-secondary">
          Send another message
        </button>
      </div>
    );
  }

  const field = (name: Field) => ({
    id: name,
    name,
    value: form[name],
    onChange: set(name),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: `${inputClass} ${errors[name] ? 'border-red-600' : 'border-gray-500'}`,
  });
  const err = (name: Field) =>
    errors[name] ? (
      <p id={`${name}-error`} className="text-sm text-red-600 mt-1">
        {errors[name]}
      </p>
    ) : null;

  const req = (
    <span className="text-red-700" aria-hidden="true">
      {' '}
      *
    </span>
  );

  const waitingOnCheck = !!TURNSTILE_SITE_KEY && !captcha && !loading;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate>
      <p className="text-sm text-gray-600">
        Fields marked <span className="text-red-700" aria-hidden="true">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>
      {formError && (
        <div
          ref={alertRef}
          tabIndex={-1}
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
          role="alert"
        >
          {formError}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
            {req}
          </label>
          <input type="text" autoComplete="name" required placeholder="John Doe" {...field('full_name')} />
          {err('full_name')}
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input type="tel" autoComplete="tel" placeholder="(555) 555-5555" {...field('phone')} />
          {err('phone')}
        </div>
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
          {req}
        </label>
        <input type="email" autoComplete="email" required placeholder="you@example.com" {...field('email')} />
        {err('email')}
      </div>
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
          Subject
        </label>
        <select {...field('subject')}>
          {CONTACT_SUBJECTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Message
          {req}
        </label>
        <textarea
          rows={5}
          required
          placeholder="Tell us how we can help..."
          {...field('message')}
          className={`${field('message').className} resize-none`}
        />
        {err('message')}
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>
      <Turnstile onToken={setCaptcha} resetKey={captchaRound} />
      <button
        type="submit"
        disabled={loading || waitingOnCheck}
        aria-describedby={waitingOnCheck ? 'contact-check-hint' : undefined}
        className="w-full btn btn-primary btn-lg inline-flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin" aria-hidden="true" />}
        {loading ? 'Sending...' : 'Send Message'}
      </button>
      <p id="contact-check-hint" className="text-sm text-gray-600 text-center" aria-live="polite">
        {waitingOnCheck ? 'Finish the security check above to send your message.' : ''}
      </p>
    </form>
  );
}
