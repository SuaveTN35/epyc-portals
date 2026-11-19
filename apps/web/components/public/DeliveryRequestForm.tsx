'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Loader2, Send } from 'lucide-react';
import Turnstile, { TURNSTILE_SITE_KEY } from '@/components/public/Turnstile';
import { ITEM_TYPES, SERVICE_LEVELS } from '@/lib/public-requests';

const inputClass =
  'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base';

const EMPTY = {
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  company_name: '',
  pickup_address: '',
  dropoff_address: '',
  item_type: '',
  item_description: '',
  service_level: 'same_day',
  pickup_date: '',
  time_window: '',
  notes: '',
  website: '',
};

type Field = keyof typeof EMPTY;

/**
 * Public "Request a delivery" form. No account needed: the request goes to the
 * dispatch inbox and a dispatcher calls back with the price.
 */
export default function DeliveryRequestForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const [reference, setReference] = useState<string | null>(null);

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
      const res = await fetch('/api/public/delivery-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstile_token: captcha }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reference?: string;
        error?: string;
        fields?: Record<string, string>;
      };
      if (res.ok && data.ok) {
        setReference(data.reference || '');
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

  if (reference !== null) {
    return (
      <div className="text-center py-8" role="status">
        <CheckCircle className="h-14 w-14 text-epyc-primary mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Request received</h3>
        {reference && (
          <p className="text-gray-700 mb-2">
            Your reference is <strong>{reference}</strong>.
          </p>
        )}
        <p className="text-gray-600 mb-6">
          A dispatcher will call you shortly to confirm the price and pickup time. Nothing is booked
          or charged until you confirm. If it is urgent, call{' '}
          <a href="tel:8182170070" className="text-epyc-primary font-semibold">
            (818) 217-0070
          </a>
          .
        </p>
        <button type="button" onClick={() => setReference(null)} className="btn btn-secondary">
          Request another delivery
        </button>
      </div>
    );
  }

  const field = (name: Field) => ({
    id: `dr-${name}`,
    name,
    value: form[name],
    onChange: set(name),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `dr-${name}-error` : undefined,
    className: `${inputClass} ${errors[name] ? 'border-red-400' : 'border-gray-300'}`,
  });

  const label = (name: Field, text: string, required = false) => (
    <label htmlFor={`dr-${name}`} className="block text-sm font-medium text-gray-700 mb-1">
      {text}
      {required && <span className="text-red-600"> *</span>}
    </label>
  );

  const err = (name: Field) =>
    errors[name] ? (
      <p id={`dr-${name}-error`} className="text-sm text-red-600 mt-1">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-5 text-left" noValidate>
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
          {formError}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-gray-900 mb-1">Pickup and drop-off</legend>
        <div>
          {label('pickup_address', 'Pickup address', true)}
          <input type="text" autoComplete="off" placeholder="Street, city, ZIP" required {...field('pickup_address')} />
          {err('pickup_address')}
        </div>
        <div>
          {label('dropoff_address', 'Drop-off address', true)}
          <input type="text" autoComplete="off" placeholder="Street, city, ZIP" required {...field('dropoff_address')} />
          {err('dropoff_address')}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-gray-900 mb-1">What and when</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            {label('item_type', 'What are we delivering?', true)}
            <select required {...field('item_type')}>
              <option value="">Choose one</option>
              {ITEM_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {err('item_type')}
          </div>
          <div>
            {label('service_level', 'When do you need it?')}
            <select {...field('service_level')}>
              {SERVICE_LEVELS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {err('service_level')}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            {label('pickup_date', 'Pickup date', form.service_level === 'scheduled')}
            <input type="date" {...field('pickup_date')} />
            {err('pickup_date')}
          </div>
          <div>
            {label('time_window', 'Time window')}
            <input type="text" placeholder="e.g. pickup 1 to 3 PM" {...field('time_window')} />
            {err('time_window')}
          </div>
        </div>
        <div>
          {label('item_description', 'Size and weight (optional)')}
          <input type="text" placeholder="e.g. 2 boxes, about 40 lbs" {...field('item_description')} />
          {err('item_description')}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-gray-900 mb-1">Your contact info</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            {label('contact_name', 'Full name', true)}
            <input type="text" autoComplete="name" required {...field('contact_name')} />
            {err('contact_name')}
          </div>
          <div>
            {label('company_name', 'Company (optional)')}
            <input type="text" autoComplete="organization" {...field('company_name')} />
            {err('company_name')}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            {label('contact_phone', 'Phone', true)}
            <input type="tel" autoComplete="tel" required placeholder="(555) 555-5555" {...field('contact_phone')} />
            {err('contact_phone')}
          </div>
          <div>
            {label('contact_email', 'Email', true)}
            <input type="email" autoComplete="email" required placeholder="you@example.com" {...field('contact_email')} />
            {err('contact_email')}
          </div>
        </div>
        <div>
          {label('notes', 'Notes for the driver (optional)')}
          <textarea rows={3} {...field('notes')} className={`${field('notes').className} resize-none`} />
          {err('notes')}
        </div>
      </fieldset>

      {/* Honeypot: hidden from people, bots fill it in. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="dr-website">Website</label>
        <input id="dr-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      <Turnstile onToken={setCaptcha} resetKey={captchaRound} />
      <button type="submit" disabled={loading || (!!TURNSTILE_SITE_KEY && !captcha)} className="w-full btn btn-primary btn-lg inline-flex justify-center items-center">
        {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}
        {loading ? 'Sending...' : 'Request Delivery'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        A dispatcher calls you back with the price. Nothing is booked or charged until you confirm.
        Regular customer?{' '}
        <Link href="/client/register" className="text-epyc-primary font-medium">
          Create a client account
        </Link>{' '}
        to book and track online.
      </p>
    </form>
  );
}
