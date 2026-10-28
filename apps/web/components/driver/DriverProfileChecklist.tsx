'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil } from 'lucide-react';
import { ProfileItemRow } from './ProfileItemRow';
import { uploadProfileItemPhoto } from '@/lib/upload-client';
import {
  checklist,
  formatLimits,
  DIMENSION_BOUNDS,
  type DimensionKey,
  type DriverProfileFields,
  type ItemStatus,
  type ReviewRow,
} from '@/lib/driver-profile';
import { GROUP_LABELS, type ProfileItemGroup } from '@/lib/driver-profile-items';

export interface ChecklistDriver extends DriverProfileFields {
  vehicle_type?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_plate?: string | null;
}

interface Props {
  driver: ChecklistDriver;
  reviews: ReviewRow[];
}

async function postDetails(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/driver/profile/details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save. Please try again.');
}

/**
 * Driver profile: "Vehicle & insurance" details plus the checklist of every
 * item in lib/driver-profile-items.ts (required first, then extras). Every
 * upload or edit goes back to dispatch for approval.
 */
export function DriverProfileChecklist({ driver, reviews }: Props) {
  const router = useRouter();
  const items = useMemo(() => checklist(driver, reviews), [driver, reviews]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const paths = useMemo(() => items.map((s) => s.path).filter((p): p is string => !!p), [items]);
  useEffect(() => {
    if (paths.length === 0) return;
    let cancelled = false;
    fetch('/api/driver/profile/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
      .then((r) => (r.ok ? r.json() : { urls: {} }))
      .then((d) => {
        if (!cancelled) setThumbs(d.urls || {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [paths]);

  const upload = (s: ItemStatus) => async (file: File) => {
    await uploadProfileItemPhoto(file, s.def.id, { allowPdf: !!s.def.allowPdf, record: true });
    router.refresh();
  };

  const row = (s: ItemStatus) => (
    <ProfileItemRow
      key={s.def.id}
      def={s.def}
      state={s.state}
      reason={s.reason}
      thumbUrl={s.path ? thumbs[s.path] ?? null : null}
      isPdf={!!s.path && s.path.toLowerCase().endsWith('.pdf')}
      onFile={s.def.kind === 'photo' ? upload(s) : undefined}
    >
      {s.def.id === 'cargo_dimensions' && <DimensionsForm driver={driver} onSaved={() => router.refresh()} />}
      {s.def.id === 'insurance_card' && <InsuranceForm driver={driver} onSaved={() => router.refresh()} />}
      {s.def.id === 'registration' && <RegistrationForm driver={driver} onSaved={() => router.refresh()} />}
    </ProfileItemRow>
  );

  const required = items.filter((s) => s.def.required);
  const extras = items.filter((s) => !s.def.required);
  const groups: ProfileItemGroup[] = ['vehicle', 'documents', 'equipment'];

  return (
    <>
      <div id="vehicle-insurance" className="bg-white rounded-xl shadow-sm mb-4">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Vehicle &amp; insurance</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Anything you change here goes to dispatch for approval. Changing insurance pauses new job offers until it is approved.
          </p>
        </div>
        <div className="px-4 py-3 text-sm space-y-1 border-b border-gray-100">
          <div className="flex justify-between">
            <span className="text-gray-500">Vehicle</span>
            <span className="text-gray-900 text-right">
              {[driver.vehicle_year, driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(' ') || 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Plate</span>
            <span className="text-gray-900">{driver.vehicle_plate || 'Not set'}</span>
          </div>
          <p className="text-xs text-gray-500 pt-1">
            New vehicle or plate? Email admin@epyccs.com and dispatch will update it.
          </p>
        </div>
        <div className="px-4">
          {groups.map((g) => {
            const list = required.filter((s) => s.def.group === g);
            if (list.length === 0) return null;
            return (
              <div key={g} className="pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{GROUP_LABELS[g]}</h4>
                <ul className="divide-y divide-gray-100">{list.map(row)}</ul>
              </div>
            );
          })}
        </div>
      </div>

      {extras.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Extras that get you more jobs</h3>
            <p className="text-xs text-gray-500 mt-0.5">Optional. Dispatch sees these when picking a driver for a job.</p>
          </div>
          <ul className="px-4 divide-y divide-gray-100">{extras.map(row)}</ul>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-base';

function EditToggle({ summary, children, open, setOpen }: { summary: React.ReactNode; children: React.ReactNode; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <div className="mt-2 ml-9">
      {!open ? (
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-gray-600 space-y-0.5">{summary}</div>
          <button type="button" onClick={() => setOpen(true)} className="text-sm text-epyc-primary inline-flex items-center flex-shrink-0">
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function SaveRow({ saving, error, onCancel }: { saving: boolean; error: string | null; onCancel: () => void }) {
  return (
    <>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 bg-epyc-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </button>
      </div>
    </>
  );
}

function useSave(onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const run = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await postDetails(body);
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, open, setOpen, run };
}

function InsuranceForm({ driver, onSaved }: { driver: ChecklistDriver; onSaved: () => void }) {
  const s = useSave(onSaved);
  const [f, setF] = useState({
    insurance_carrier: driver.insurance_carrier ?? '',
    insurance_policy: driver.insurance_policy ?? '',
    insurance_expiry: driver.insurance_expiry?.slice(0, 10) ?? '',
    insurance_bi_per_person: driver.insurance_bi_per_person?.toString() ?? '',
    insurance_bi_per_accident: driver.insurance_bi_per_accident?.toString() ?? '',
    insurance_pd_limit: driver.insurance_pd_limit?.toString() ?? '',
    insurance_business_use: driver.insurance_business_use ?? null,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <EditToggle
      open={s.open}
      setOpen={s.setOpen}
      summary={
        <>
          <p>Company: {driver.insurance_carrier || 'Not set'}</p>
          <p>Policy: {driver.insurance_policy || 'Not set'}</p>
          <p>Expires: {driver.insurance_expiry?.slice(0, 10) || 'Not set'}</p>
          <p>Limits: {formatLimits(driver) || 'Not set'}</p>
          <p>
            Covers delivery / business use:{' '}
            {driver.insurance_business_use == null ? 'Not answered' : driver.insurance_business_use ? 'Yes' : 'No'}
          </p>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          s.run({ section: 'insurance', ...f });
        }}
      >
        <Field label="Insurance company">
          <input className={inputCls} value={f.insurance_carrier} onChange={set('insurance_carrier')} maxLength={100} />
        </Field>
        <Field label="Policy number">
          <input className={inputCls} value={f.insurance_policy} onChange={set('insurance_policy')} maxLength={60} />
        </Field>
        <Field label="Expiration date">
          <input type="date" className={inputCls} value={f.insurance_expiry} onChange={set('insurance_expiry')} />
        </Field>
        <p className="text-xs text-gray-500">Coverage limits in dollars, as shown on your card or declarations page.</p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Injury per person ($)">
            <input inputMode="numeric" className={inputCls} value={f.insurance_bi_per_person} onChange={set('insurance_bi_per_person')} placeholder="30000" />
          </Field>
          <Field label="Injury per accident ($)">
            <input inputMode="numeric" className={inputCls} value={f.insurance_bi_per_accident} onChange={set('insurance_bi_per_accident')} placeholder="60000" />
          </Field>
          <Field label="Property damage ($)">
            <input inputMode="numeric" className={inputCls} value={f.insurance_pd_limit} onChange={set('insurance_pd_limit')} placeholder="15000" />
          </Field>
        </div>
        <fieldset>
          <legend className="block text-xs font-medium text-gray-700 mb-1">Does your policy cover delivery / business use?</legend>
          <div className="flex gap-2">
            {[
              { v: true, t: 'Yes' },
              { v: false, t: 'No' },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                onClick={() => setF({ ...f, insurance_business_use: o.v })}
                className={`flex-1 py-2 rounded-lg border text-sm ${f.insurance_business_use === o.v ? 'border-epyc-primary bg-emerald-50 text-gray-900' : 'border-gray-300 text-gray-700'}`}
              >
                {o.t}
              </button>
            ))}
          </div>
        </fieldset>
        <SaveRow saving={s.saving} error={s.error} onCancel={() => s.setOpen(false)} />
      </form>
    </EditToggle>
  );
}

function RegistrationForm({ driver, onSaved }: { driver: ChecklistDriver; onSaved: () => void }) {
  const s = useSave(onSaved);
  const [expiry, setExpiry] = useState(driver.registration_expiry?.slice(0, 10) ?? '');
  return (
    <EditToggle open={s.open} setOpen={s.setOpen} summary={<p>Expires: {driver.registration_expiry?.slice(0, 10) || 'Not set'}</p>}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          s.run({ section: 'registration', registration_expiry: expiry });
        }}
      >
        <Field label="Registration expiration date">
          <input type="date" className={inputCls} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </Field>
        <SaveRow saving={s.saving} error={s.error} onCancel={() => s.setOpen(false)} />
      </form>
    </EditToggle>
  );
}

function DimensionsForm({ driver, onSaved }: { driver: ChecklistDriver; onSaved: () => void }) {
  const s = useSave(onSaved);
  const [f, setF] = useState<Record<DimensionKey, string>>({
    cargo_length_in: driver.cargo_length_in?.toString() ?? '',
    cargo_width_in: driver.cargo_width_in?.toString() ?? '',
    cargo_height_in: driver.cargo_height_in?.toString() ?? '',
    cargo_capacity_lbs: driver.cargo_capacity_lbs?.toString() ?? '',
  });
  const v = (k: DimensionKey) => driver[k];
  return (
    <EditToggle
      open={s.open}
      setOpen={s.setOpen}
      summary={
        v('cargo_length_in') != null ? (
          <p>
            {v('cargo_length_in')} x {v('cargo_width_in')} x {v('cargo_height_in')} in (L x W x H), max load {v('cargo_capacity_lbs') ?? '-'} lbs
          </p>
        ) : (
          <p>Not entered yet</p>
        )
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          s.run({ section: 'dimensions', ...f });
        }}
      >
        <p className="text-xs text-gray-500">Measure the space where the load goes, in inches.</p>
        <div className="grid grid-cols-3 gap-2">
          {(['cargo_length_in', 'cargo_width_in', 'cargo_height_in'] as const).map((k) => (
            <Field key={k} label={`${DIMENSION_BOUNDS[k].label.replace('Cargo ', '')} (in)`}>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min={DIMENSION_BOUNDS[k].min}
                max={DIMENSION_BOUNDS[k].max}
                className={inputCls}
                value={f[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <Field label="Max load (lbs)">
          <input
            type="number"
            inputMode="numeric"
            min={DIMENSION_BOUNDS.cargo_capacity_lbs.min}
            max={DIMENSION_BOUNDS.cargo_capacity_lbs.max}
            className={inputCls}
            value={f.cargo_capacity_lbs}
            onChange={(e) => setF({ ...f, cargo_capacity_lbs: e.target.value })}
          />
        </Field>
        <SaveRow saving={s.saving} error={s.error} onCancel={() => s.setOpen(false)} />
      </form>
    </EditToggle>
  );
}
