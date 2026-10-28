'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  checklist,
  expiryState,
  formatLimits,
  newWorkBlockReason,
  pacificToday,
  profileGaps,
  type DriverProfileFields,
  type ItemStatus,
  type ReviewRow,
} from '@/lib/driver-profile';
import { GROUP_LABELS, type ProfileItemGroup } from '@/lib/driver-profile-items';
import { StateIcon } from '@/components/driver/ProfileItemRow';

export interface ReviewPanelDriver extends DriverProfileFields {
  id: string;
  vehicle_length?: number | null;
  vehicle_width?: number | null;
  vehicle_height?: number | null;
  cargo_capacity?: number | null;
}

const STATE_LABEL = {
  approved: 'Approved',
  pending: 'Waiting for review',
  unreviewed: 'On file, not reviewed',
  rejected: 'Rejected',
  missing: 'Missing',
  declared: 'Owns it, no photo',
} as const;

function ExpiryTag({ date }: { date: string | null | undefined }) {
  const st = expiryState(date, pacificToday());
  const cls =
    st === 'expired' ? 'bg-red-100 text-red-800' : st === 'expiring' ? 'bg-amber-100 text-amber-800' : st === 'missing' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800';
  const text = st === 'expired' ? 'Expired' : st === 'expiring' ? 'Expiring soon' : st === 'missing' ? 'Not set' : 'Current';
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
}

/**
 * Dispatch driver page: one "Documents & vehicle" panel with insurance and
 * registration details, every checklist item (required first, then extras)
 * with photo, approve, and reject-with-reason, and what is still missing.
 * Decisions go through POST /api/dispatch/drivers/:id/review.
 */
export function DriverReviewPanel({ driver }: { driver: ReviewPanelDriver }) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from('driver_review_items')
      .select('item, photo_path, status, reason, owned, uploaded_at, reviewed_at')
      .eq('driver_id', driver.id);
    if (loadError) setError('Could not load review items.');
    setRows((data as ReviewRow[]) || []);
    setLoading(false);
  }, [driver.id]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => checklist(driver, rows), [driver, rows]);
  const gaps = useMemo(() => profileGaps(driver, rows), [driver, rows]);
  const block = useMemo(
    () => newWorkBlockReason(driver, rows, pacificToday()),
    [driver, rows]
  );

  const paths = useMemo(() => items.map((s) => s.path).filter((p): p is string => !!p), [items]);
  useEffect(() => {
    if (paths.length === 0) return;
    fetch('/api/documents/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
      .then((r) => (r.ok ? r.json() : { urls: {} }))
      .then((d) => setUrls(d.urls || {}))
      .catch(() => undefined);
  }, [paths]);

  const decide = async (s: ItemStatus, decision: 'approve' | 'reject', reason?: string) => {
    setBusyItem(s.def.id);
    setError(null);
    try {
      const res = await fetch(`/api/dispatch/drivers/${driver.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // uploaded_at is the review version this page showed (QA N2).
        body: JSON.stringify({
          item: s.def.id,
          decision,
          reason,
          photo_path: s.path,
          uploaded_at: reviewRow[s.def.id]?.uploaded_at ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save the review.');
      } else {
        setRejecting(null);
        setRejectReason('');
        await load();
      }
    } catch {
      setError('Could not save the review.');
    } finally {
      setBusyItem(null);
    }
  };

  const reviewRow = rows.reduce<Record<string, ReviewRow>>((m, r) => ((m[r.item] = r), m), {});

  const renderItem = (s: ItemStatus) => {
    const url = s.path ? urls[s.path] : null;
    const isPdf = !!s.path && s.path.toLowerCase().endsWith('.pdf');
    const r = reviewRow[s.def.id];
    return (
      <li key={s.def.id} className="py-3">
        <div className="flex items-start gap-3">
          <StateIcon state={s.state} className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900">{s.def.label}</span>
              {s.def.group !== 'equipment' && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${s.def.required ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-600'}`}>
                  {s.def.required ? 'Required' : 'Optional'}
                </span>
              )}
            </div>
            <p className={`text-xs ${s.state === 'rejected' ? 'text-red-700' : 'text-gray-500'}`}>
              {s.def.group === 'equipment' && s.state === 'missing' ? 'Not listed' : STATE_LABEL[s.state]}
              {s.state === 'rejected' && s.reason ? `: ${s.reason}` : ''}
              {r?.reviewed_at && (s.state === 'approved' || s.state === 'rejected')
                ? ` (${new Date(r.reviewed_at).toLocaleDateString()})`
                : ''}
            </p>
            {s.def.id === 'cargo_dimensions' && (
              <p className="text-xs text-gray-700 mt-1">
                {driver.cargo_length_in != null
                  ? `${driver.cargo_length_in} x ${driver.cargo_width_in} x ${driver.cargo_height_in} in (L x W x H), max load ${driver.cargo_capacity_lbs ?? '-'} lbs`
                  : 'Not entered'}
                {driver.vehicle_length != null && (
                  <span className="block text-gray-500">
                    Older entry: {driver.vehicle_length} x {driver.vehicle_width ?? '-'} x {driver.vehicle_height ?? '-'} ft
                    {driver.cargo_capacity != null ? `, ${driver.cargo_capacity} cu ft` : ''}
                  </span>
                )}
              </p>
            )}
            {rejecting === s.def.id && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  maxLength={500}
                  placeholder="Reason the driver will see"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <button
                  type="button"
                  disabled={busyItem === s.def.id || rejectReason.trim().length < 3}
                  onClick={() => decide(s, 'reject', rejectReason.trim())}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Reject
                </button>
                <button type="button" onClick={() => setRejecting(null)} className="px-2 py-1.5 text-sm text-gray-600">
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {url &&
              (isPdf ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-epyc-primary inline-flex items-center">
                  PDF <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={s.def.label} className="w-12 h-12 rounded object-cover bg-gray-100" />
                </a>
              ))}
            {s.state !== 'missing' && (s.def.kind === 'data' || !!s.path) && rejecting !== s.def.id && (
              <>
                {s.state !== 'approved' && (
                  <button
                    type="button"
                    disabled={busyItem === s.def.id}
                    onClick={() => decide(s, 'approve')}
                    className="px-2.5 py-1.5 text-xs bg-green-600 text-white rounded disabled:opacity-50"
                  >
                    {busyItem === s.def.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
                  </button>
                )}
                {s.state !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(s.def.id);
                      setRejectReason('');
                    }}
                    className="px-2.5 py-1.5 text-xs border border-red-300 text-red-700 rounded"
                  >
                    Reject
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </li>
    );
  };

  const groups: ProfileItemGroup[] = ['documents', 'vehicle'];
  const required = items.filter((s) => s.def.group === 'documents' || s.def.group === 'vehicle');
  const gear = items.filter((s) => s.def.group === 'equipment');
  const badge = items.filter((s) => s.def.group === 'badge');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Documents &amp; vehicle</h2>
      <p className={`text-sm mb-4 ${block ? 'text-red-700' : 'text-green-700'}`}>
        {block ? `No new jobs: ${block}` : 'Insurance approved and required items uploaded: can get new jobs'}
      </p>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Insurance</span>
            <ExpiryTag date={driver.insurance_expiry} />
          </div>
          <p>{driver.insurance_carrier || 'Company not set'}</p>
          <p className="font-mono text-xs">{driver.insurance_policy || '-'}</p>
          <p className="text-xs text-gray-600">Expires: {driver.insurance_expiry?.slice(0, 10) || '-'}</p>
          <p className="text-xs text-gray-600">Limits (BI person / BI accident / PD): {formatLimits(driver) || '-'}</p>
          <p className={`text-xs ${driver.insurance_business_use === false ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
            Covers delivery / business use:{' '}
            {driver.insurance_business_use == null ? 'Not answered' : driver.insurance_business_use ? 'Yes' : 'No'}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Registration</span>
            <ExpiryTag date={driver.registration_expiry} />
          </div>
          <p className="text-xs text-gray-600">Expires: {driver.registration_expiry?.slice(0, 10) || '-'}</p>
          <p className="text-xs text-gray-500">An expired registration warns the driver; it does not block jobs.</p>
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
          <p className="font-medium text-gray-800 mb-1">Missing (required)</p>
          <ul className="list-disc ml-5 space-y-0.5 text-gray-700">
            {gaps.map((g) => (
              <li key={g.group}>
                <span className="font-medium">{g.label}:</span> {g.missing.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-epyc-primary" />
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g} className="mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-2">{GROUP_LABELS[g]}</h3>
              <ul className="divide-y divide-gray-100">{required.filter((s) => s.def.group === g).map(renderItem)}</ul>
            </div>
          ))}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-2">Gear the driver owns (declared, optional)</h3>
            <p className="text-xs text-gray-500">
              Never required. Used for matching; each job lists the gear it needs and the driver may decline.
            </p>
            <ul className="divide-y divide-gray-100">{gear.map(renderItem)}</ul>
          </div>
          {badge.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-2">ID badge photo (after approval)</h3>
              <ul className="divide-y divide-gray-100">{badge.map(renderItem)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
