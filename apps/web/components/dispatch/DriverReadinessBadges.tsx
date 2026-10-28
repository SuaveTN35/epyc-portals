'use client';

import { Forklift, Layers, Snowflake, Package } from 'lucide-react';
import type { DispatchBadge } from '@/lib/driver-profile';
import type { ProfileItemDef } from '@/lib/driver-profile-items';

const EXTRA_ICONS: Record<string, React.ElementType> = {
  hand_truck: Forklift,
  straps_blankets: Layers,
  cooler_temp_kit: Snowflake,
};

const TONE: Record<DispatchBadge['tone'], string> = {
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  gray: 'bg-gray-100 text-gray-700',
};

/** Insurance / registration / missing-required badges (P-366). */
export function DriverReadinessBadges({ badges }: { badges: DispatchBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b.key} className={`text-xs px-2 py-0.5 rounded-full ${TONE[b.tone]}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

/** Small icons for approved optional equipment, for picking the right driver. */
export function DriverExtrasIcons({ extras }: { extras: ProfileItemDef[] }) {
  if (extras.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {extras.map((x) => {
        const Icon = EXTRA_ICONS[x.id] ?? Package;
        return (
          <span
            key={x.id}
            title={x.label}
            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{x.shortLabel || x.label}</span>
          </span>
        );
      })}
    </div>
  );
}
