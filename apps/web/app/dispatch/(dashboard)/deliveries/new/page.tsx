'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, MapPin, Package, DollarSign, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SERVICE_LEVEL_CONFIG, VEHICLE_CONFIG, generateTrackingNumber } from '@epyc/shared';
import {
  EMPTY_NEW_JOB,
  JOB_SOURCES,
  SERVICE_LEVELS,
  VEHICLE_TYPES,
  buildNewJobRow,
  validateNewJob,
  type NewJobErrors,
  type NewJobForm,
} from '@/lib/new-job';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-epyc-primary focus:border-transparent';

function Field({
  label,
  error,
  required,
  children,
  className = '',
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function NewJobPage() {
  const router = useRouter();
  const [form, setForm] = useState<NewJobForm>(EMPTY_NEW_JOB);
  const [errors, setErrors] = useState<NewJobErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof NewJobForm>(key: K, value: NewJobForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const text = (key: keyof NewJobForm) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value as never),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const found = validateNewJob(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSaveError('Fix the highlighted fields and save again.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveError('Your session expired. Sign in again.');
      setSaving(false);
      return;
    }

    const row = buildNewJobRow(form, user.id, generateTrackingNumber());
    const { data, error } = await supabase
      .from('deliveries')
      .insert(row)
      .select('id')
      .single();

    if (error || !data) {
      setSaveError(error?.message || 'Could not save the job.');
      setSaving(false);
      return;
    }

    await supabase.from('delivery_events').insert({
      delivery_id: data.id,
      event_type: 'created_by_dispatch',
      new_status: 'booked',
      notes: 'Job entered by dispatch',
      created_by: user.id,
    });

    router.push(`/dispatch/deliveries/${data.id}?created=1`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dispatch/deliveries"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Job</h1>
          <p className="text-sm text-gray-500">
            Enter a job from Curri, Walmart Spark, a broker, or a phone order
          </p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center text-sm text-yellow-800">
        <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
        Do not enter patient names or medical details.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Source */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Source</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Job source" required error={errors.source}>
              <select
                className={inputClass}
                value={form.source}
                onChange={(e) => set('source', e.target.value as NewJobForm['source'])}
              >
                {JOB_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Source reference (their job or order #)"
              required={form.source !== 'direct' && form.source !== 'other'}
              error={errors.source_reference}
            >
              <input className={inputClass} {...text('source_reference')} />
            </Field>
          </div>
        </div>

        {/* Pickup and delivery */}
        {(['pickup', 'delivery'] as const).map((leg) => (
          <div key={leg} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MapPin
                className={`h-5 w-5 mr-2 ${leg === 'pickup' ? 'text-green-600' : 'text-red-600'}`}
              />
              {leg === 'pickup' ? 'Pickup' : 'Delivery'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <Field
                label="Street address"
                required
                error={errors[`${leg}_address`]}
                className="sm:col-span-6"
              >
                <input className={inputClass} {...text(`${leg}_address`)} />
              </Field>
              <Field label="City" required error={errors[`${leg}_city`]} className="sm:col-span-3">
                <input className={inputClass} {...text(`${leg}_city`)} />
              </Field>
              <Field label="State" required error={errors[`${leg}_state`]} className="sm:col-span-1">
                <input className={inputClass} maxLength={2} {...text(`${leg}_state`)} />
              </Field>
              <Field label="ZIP" required error={errors[`${leg}_zip`]} className="sm:col-span-2">
                <input className={inputClass} inputMode="numeric" {...text(`${leg}_zip`)} />
              </Field>
              <Field label="Contact name" className="sm:col-span-3">
                <input className={inputClass} {...text(`${leg}_contact_name`)} />
              </Field>
              <Field label="Contact phone" className="sm:col-span-3">
                <input className={inputClass} type="tel" {...text(`${leg}_contact_phone`)} />
              </Field>
              <Field
                label="Window start"
                error={errors[`${leg}_window_start`]}
                className="sm:col-span-3"
              >
                <input
                  className={inputClass}
                  type="datetime-local"
                  {...text(`${leg}_window_start`)}
                />
              </Field>
              <Field
                label="Window end"
                error={errors[`${leg}_window_end`]}
                className="sm:col-span-3"
              >
                <input
                  className={inputClass}
                  type="datetime-local"
                  {...text(`${leg}_window_end`)}
                />
              </Field>
              <Field label="Instructions" className="sm:col-span-6">
                <textarea className={inputClass} rows={2} {...text(`${leg}_instructions`)} />
              </Field>
            </div>
          </div>
        ))}

        {/* Package and service */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2 text-gray-600" />
            Package and Service
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Field
              label="Package description"
              required
              error={errors.package_description}
              className="sm:col-span-4"
            >
              <input className={inputClass} {...text('package_description')} />
            </Field>
            <Field label="Weight (lbs)" error={errors.package_weight} className="sm:col-span-2">
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.1"
                {...text('package_weight')}
              />
            </Field>
            <Field label="Pieces / pallets" error={errors.pieces} className="sm:col-span-2">
              <input className={inputClass} type="number" min="1" step="1" {...text('pieces')} />
            </Field>
            <Field label="Service level" error={errors.service_level} className="sm:col-span-2">
              <select
                className={inputClass}
                value={form.service_level}
                onChange={(e) =>
                  set('service_level', e.target.value as NewJobForm['service_level'])
                }
              >
                {SERVICE_LEVELS.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_LEVEL_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vehicle required" error={errors.vehicle_required} className="sm:col-span-2">
              <select
                className={inputClass}
                value={form.vehicle_required}
                onChange={(e) =>
                  set('vehicle_required', e.target.value as NewJobForm['vehicle_required'])
                }
              >
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {VEHICLE_CONFIG[v].label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-epyc-primary"
                checked={form.requires_signature}
                onChange={(e) => set('requires_signature', e.target.checked)}
              />
              Signature required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-epyc-primary"
                checked={form.requires_photo_pod}
                onChange={(e) => set('requires_photo_pod', e.target.checked)}
              />
              Photo proof of delivery required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-epyc-primary"
                checked={form.loading_required}
                onChange={(e) => set('loading_required', e.target.checked)}
              />
              Loading required (driver loads or unloads)
            </label>
          </div>
        </div>

        {/* Money */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-gray-600" />
            Pay
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Job price (what Epyc is paid)" required error={errors.total_price}>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                {...text('total_price')}
              />
            </Field>
            <Field label="Driver payout" required error={errors.driver_payout}>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                {...text('driver_payout')}
              />
            </Field>
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/dispatch/deliveries"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save Job'}
          </button>
        </div>
      </form>
    </div>
  );
}
