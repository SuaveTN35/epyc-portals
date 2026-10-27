'use client';

import { Phone, Package, Truck, FileText, Navigation, CheckCircle2, Circle } from 'lucide-react';
import { VEHICLE_CONFIG, formatCurrency } from '@epyc/shared';
import type { VehicleType } from '@epyc/shared';
import { formatWindow } from '@/lib/job-offers';
import type { ChecklistItem } from '@/lib/proof-flow';
import { CopyButton } from './CopyButton';

export interface JobStop {
  label: 'Pickup' | 'Drop-off';
  /** Business or contact name for the stop (no separate business column yet). */
  name: string | null | undefined;
  address: string;
  cityLine: string;
  contactPhone: string | null | undefined;
  instructions: string | null | undefined;
  windowStart: string | null | undefined;
  windowEnd: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  checklist: ChecklistItem[];
  active: boolean;
}

export interface JobOrder {
  reference: string | null | undefined;
  description: string | null | undefined;
  weight: number | null | undefined;
  dimensions: string | null;
}

/**
 * Job card in the layout drivers know from Curri and Dispatch: pay, tags,
 * the order, customer notes, then Stop 1 of 2 (pickup) and Stop 2 of 2
 * (drop-off), each with name, address, window, call, copy, nav, and a step
 * checklist. This page only loads for the assigned driver (RLS), so
 * contacts are safe to show.
 */
export function JobDetailsCard({
  payout,
  tags,
  order,
  vehicleRequired,
  stops,
  onNavigate,
}: {
  payout: number | null | undefined;
  tags: string[];
  order: JobOrder;
  vehicleRequired: string | null | undefined;
  stops: JobStop[];
  onNavigate: (stop: JobStop) => void;
}) {
  const vehicle = vehicleRequired
    ? VEHICLE_CONFIG[vehicleRequired as VehicleType]?.label ?? vehicleRequired
    : null;
  const notes = stops.filter((s) => s.instructions);

  return (
    <div className="mx-4 mt-4 space-y-4">
      {/* Pay and tags */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">You will earn</span>
          <span className="text-2xl font-bold text-epyc-primary">{formatCurrency(payout || 0)}</span>
        </div>
        {(tags.length > 0 || vehicle) && (
          <div className="flex flex-wrap gap-2 mt-3 text-sm">
            {vehicle && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                <Truck className="h-4 w-4 mr-1" />
                {vehicle}
              </span>
            )}
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-800 font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Order */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center">
          <Package className="h-4 w-4 mr-1" />
          Order
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Reference / PO</dt>
          <dd className="font-medium text-gray-900 break-all">{order.reference || '-'}</dd>
          <dt className="text-gray-500">Weight</dt>
          <dd className="font-medium text-gray-900">
            {order.weight != null ? `${order.weight} lbs` : '-'}
          </dd>
          <dt className="text-gray-500">L x W x H</dt>
          <dd className="font-medium text-gray-900">{order.dimensions || '-'}</dd>
          <dt className="text-gray-500">Description</dt>
          <dd className="font-medium text-gray-900">{order.description || '-'}</dd>
        </dl>
      </div>

      {notes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-yellow-900 uppercase tracking-wide flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            Customer notes
          </p>
          {notes.map((s) => (
            <p key={s.label} className="text-sm text-yellow-900">
              <span className="font-medium">{s.label}: </span>
              {s.instructions}
            </p>
          ))}
        </div>
      )}

      {/* Stops */}
      {stops.map((s, i) => {
        const window = formatWindow(s.windowStart ?? null, s.windowEnd ?? null);
        return (
          <div
            key={s.label}
            className={`bg-white rounded-xl shadow-sm p-4 ${s.active ? 'ring-2 ring-epyc-primary' : ''}`}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Stop {i + 1} of {stops.length} - {s.label}
            </p>
            {s.name && <p className="font-semibold text-gray-900 mt-1">{s.name}</p>}
            <p className="text-gray-900">{s.address}</p>
            <p className="text-sm text-gray-500">{s.cityLine}</p>
            {window && <p className="text-sm text-gray-700 mt-1">Window: {window}</p>}

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => onNavigate(s)}
                className="inline-flex items-center px-3 py-2 rounded-lg bg-epyc-primary text-white text-sm font-medium touch-target"
              >
                <Navigation className="h-4 w-4 mr-1" />
                Navigate
              </button>
              {s.contactPhone && (
                <a
                  href={`tel:${s.contactPhone}`}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium touch-target"
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Call
                </a>
              )}
              {s.lat != null && s.lng != null ? (
                <CopyButton value={`${s.lat}, ${s.lng}`} label="Copy coordinates" />
              ) : (
                <CopyButton value={`${s.address}, ${s.cityLine}`} label="Copy address" />
              )}
            </div>

            <ul className="mt-3 space-y-1">
              {s.checklist.map((item) => (
                <li key={item.label} className="flex items-center text-sm">
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" aria-label="Done" />
                  ) : (
                    <Circle className="h-5 w-5 mr-2 text-gray-300" aria-label="Not done" />
                  )}
                  <span className={item.done ? 'text-gray-900' : 'text-gray-500'}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
