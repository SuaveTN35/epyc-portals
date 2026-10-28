'use client';

import { Forklift, Layers, Snowflake, Package, Shirt, Glasses, Footprints, Hand, ShieldPlus } from 'lucide-react';
import type { DeclaredGear, DispatchBadge } from '@/lib/driver-profile';

export const GEAR_ICONS: Record<string, React.ElementType> = {
  hand_truck: Forklift,
  straps_blankets: Layers,
  cooler_temp_kit: Snowflake,
  hi_vis_vest: Shirt,
  safety_glasses: Glasses,
  boots: Footprints,
  gloves: Hand,
  mask: ShieldPlus,
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

/**
 * Small icons for the gear a driver lists as owned, for picking the right
 * driver. Solid green = photo approved; outlined = declared, photo not
 * approved yet. Informational only; gear never blocks a job.
 */
export function DriverGearIcons({ gear }: { gear: DeclaredGear[] }) {
  if (gear.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {gear.map(({ def, approved }) => {
        const Icon = GEAR_ICONS[def.id] ?? Package;
        return (
          <span
            key={def.id}
            title={`${def.label}${approved ? ' (photo approved)' : ' (declared)'}`}
            className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${
              approved ? 'bg-emerald-50 text-emerald-700' : 'border border-gray-300 text-gray-600'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{def.shortLabel || def.label}</span>
          </span>
        );
      })}
    </div>
  );
}
