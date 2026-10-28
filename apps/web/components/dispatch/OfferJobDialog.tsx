'use client';

import { useEffect, useState } from 'react';
import { Loader2, X, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  OFFER_EXPIRY_MINUTES,
  distanceToPickupMiles,
  offerExpiresAt,
} from '@/lib/job-offers';
import { requestOfferTexts } from '@/lib/sms-client';
import { loadDriverReadiness } from '@/lib/driver-readiness';

interface OfferDriver {
  id: string;
  full_name: string;
  vehicle_type: string | null;
  is_online: boolean;
  busy: boolean;
  current_lat: number | null;
  current_lng: number | null;
  has_open_offer: boolean;
  /** P-366: why this driver cannot get new offers (insurance), or null. */
  block_reason: string | null;
  /** Approved optional equipment (dolly, blankets, cooler) for matching. */
  extras: string[];
}

interface OfferJobDialogProps {
  delivery: {
    id: string;
    driver_payout: number | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
  };
  onClose: () => void;
  onSent: (count: number) => void;
}

/**
 * Lets dispatch offer a booked job to one or more active drivers. Inserts one
 * job_offers row per driver (staff insert policy from Phase 1). The first
 * driver to accept wins; see app/api/driver/offers/[id]/respond/route.ts.
 */
export function OfferJobDialog({ delivery, onClose, onSent }: OfferJobDialogProps) {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<OfferDriver[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expiry, setExpiry] = useState<number>(15);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [{ data: driverRows, error: driverError }, { data: openOffers }] = await Promise.all([
        supabase
          .from('drivers')
          .select(
            'id, vehicle_type, is_online, current_delivery_id, current_lat, current_lng, profiles(full_name)'
          )
          .eq('status', 'active')
          .order('is_online', { ascending: false }),
        supabase
          .from('job_offers')
          .select('driver_id')
          .eq('delivery_id', delivery.id)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString()),
      ]);

      if (driverError) {
        setError(driverError.message);
      }
      const offered = new Set((openOffers || []).map((o: any) => o.driver_id as string));
      const readiness = await loadDriverReadiness(
        supabase,
        (driverRows || []).map((d: any) => d.id as string)
      );
      setDrivers(
        (driverRows || []).map((d: any) => ({
          id: d.id,
          full_name: d.profiles?.full_name || 'Unknown',
          vehicle_type: d.vehicle_type,
          is_online: !!d.is_online,
          busy: !!d.current_delivery_id,
          current_lat: d.current_lat,
          current_lng: d.current_lng,
          has_open_offer: offered.has(d.id),
          // Unknown readiness (lookup failed) is treated as blocked; the
          // database refuses the offer anyway.
          block_reason: readiness[d.id] ? readiness[d.id].blockReason : 'Insurance status unknown',
          extras: (readiness[d.id]?.extras || []).map((x) => x.shortLabel || x.label),
        }))
      );
      setLoading(false);
    };
    load();
  }, [delivery.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0) {
      setError('Select at least one driver.');
      return;
    }
    setSending(true);
    setError(null);

    const supabase = createClient();
    const expiresAt = offerExpiresAt(expiry);
    const rows = drivers
      .filter((d) => selected.has(d.id) && !d.block_reason)
      .map((d) => ({
        delivery_id: delivery.id,
        driver_id: d.id,
        status: 'pending',
        estimated_payout: delivery.driver_payout,
        distance_to_pickup_miles: distanceToPickupMiles(d, delivery),
        expires_at: expiresAt,
      }));

    const { error: insertError } = await supabase.from('job_offers').insert(rows);
    if (insertError) {
      setError(insertError.message);
      setSending(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from('delivery_events').insert({
      delivery_id: delivery.id,
      event_type: 'offer_sent',
      notes: `Offered to ${rows.length} driver${rows.length === 1 ? '' : 's'}, expires in ${expiry} min`,
      created_by: user?.id ?? null,
    });

    // Text each offered driver who opted in to SMS (server checks staff + consent).
    requestOfferTexts(delivery.id, rows.map((r) => r.driver_id));

    setSending(false);
    onSent(rows.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Offer Job to Drivers</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {delivery.driver_payout == null && (
            <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
              This job has no driver payout set. Drivers will see no pay amount.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offer expires in</label>
            <select
              value={expiry}
              onChange={(e) => setExpiry(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {OFFER_EXPIRY_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-epyc-primary" />
            </div>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-gray-500">No active drivers.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {drivers.map((d) => (
                <li key={d.id}>
                  <label
                    className={`flex items-center gap-3 p-3 ${
                      d.has_open_offer || d.block_reason ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-epyc-primary"
                      disabled={d.has_open_offer || !!d.block_reason}
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{d.full_name}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {(d.vehicle_type || 'vehicle').replace('_', ' ')}
                        {d.busy ? ' - on a job' : ''}
                        {d.has_open_offer ? ' - already offered' : ''}
                      </p>
                      {d.block_reason && (
                        <p className="text-xs text-red-700">Cannot offer: {d.block_reason}</p>
                      )}
                      {d.extras.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {d.extras.map((x) => (
                            <span key={x} className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                              {x}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        d.is_online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {d.is_online ? 'Online' : 'Offline'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending || selected.size === 0}
            className="inline-flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send {selected.size > 0 ? `to ${selected.size}` : 'Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}
