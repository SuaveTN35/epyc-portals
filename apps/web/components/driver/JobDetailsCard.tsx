'use client';

import { Phone, Package, Truck, FileText } from 'lucide-react';
import { VEHICLE_CONFIG, formatCurrency } from '@epyc/shared';
import type { VehicleType } from '@epyc/shared';
import { formatWindow } from '@/lib/job-offers';
import { CopyButton } from './CopyButton';

export interface JobStop {
  label: 'Pickup' | 'Drop-off';
  address: string;
  cityLine: string;
  contactName: string | null | undefined;
  contactPhone: string | null | undefined;
  instructions: string | null | undefined;
  windowStart: string | null | undefined;
  windowEnd: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
}

/**
 * Everything the driver needs on one card, kept small: earnings, both stops
 * with windows, contacts (tap to call), notes, items, and vehicle. This page
 * only loads for the assigned driver (RLS), so contacts are safe to show.
 */
export function JobDetailsCard({
  payout,
  stops,
  packageDescription,
  packageWeight,
  vehicleRequired,
}: {
  payout: number | null | undefined;
  stops: JobStop[];
  packageDescription: string | null | undefined;
  packageWeight: number | null | undefined;
  vehicleRequired: string | null | undefined;
}) {
  const vehicle = vehicleRequired
    ? VEHICLE_CONFIG[vehicleRequired as VehicleType]?.label ?? vehicleRequired
    : null;
  const notes = stops.filter((s) => s.instructions);

  return (
    <div className="bg-white mx-4 mt-4 rounded-xl shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-gray-600">You will earn</span>
        <span className="text-2xl font-bold text-epyc-primary">{formatCurrency(payout || 0)}</span>
      </div>

      {notes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 space-y-1">
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

      <div className="flex flex-wrap gap-2 text-sm">
        {(packageDescription || packageWeight != null) && (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            <Package className="h-4 w-4 mr-1" />
            {[packageDescription, packageWeight != null ? `${packageWeight} lbs` : null]
              .filter(Boolean)
              .join(' - ')}
          </span>
        )}
        {vehicle && (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            <Truck className="h-4 w-4 mr-1" />
            {vehicle}
          </span>
        )}
      </div>

      {stops.map((s) => {
        const window = formatWindow(s.windowStart ?? null, s.windowEnd ?? null);
        return (
          <div key={s.label} className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="font-medium text-gray-900">{s.address}</p>
            <p className="text-sm text-gray-500">{s.cityLine}</p>
            {window && <p className="text-sm text-gray-700 mt-1">Window: {window}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {s.contactPhone && (
                <a
                  href={`tel:${s.contactPhone}`}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium touch-target"
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Call {s.contactName || s.label.toLowerCase()}
                </a>
              )}
              {!s.contactPhone && s.contactName && (
                <span className="text-sm text-gray-600">Contact: {s.contactName}</span>
              )}
              {s.lat != null && s.lng != null && (
                <CopyButton value={`${s.lat}, ${s.lng}`} label="Copy coordinates" />
              )}
              {(s.lat == null || s.lng == null) && (
                <CopyButton value={`${s.address}, ${s.cityLine}`} label="Copy address" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
