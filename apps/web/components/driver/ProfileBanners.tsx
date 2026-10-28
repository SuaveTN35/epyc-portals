import Link from 'next/link';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import type { DriverWarning, ProfileGap } from '@/lib/driver-profile';

/**
 * Insurance / registration warnings and the "complete your profile" list.
 * Shown at the top of every driver screen. Insurance and the required
 * vehicle and document items block new jobs (the red warning names what is
 * missing); a few form details (insurance company, limits, registration
 * date) do not, so the footer depends on `blocked`.
 */
export function ProfileBanners({
  warnings,
  gaps,
  blocked,
}: {
  warnings: DriverWarning[];
  gaps: ProfileGap[];
  blocked: boolean;
}) {
  if (warnings.length === 0 && gaps.length === 0) return null;
  return (
    <div className="space-y-3 mb-4">
      {warnings.map((w, i) => (
        <Link
          key={i}
          href="/driver/profile#vehicle-insurance"
          className={`flex items-start gap-2 rounded-xl p-3 border ${
            w.tone === 'red' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{w.text}</span>
        </Link>
      ))}
      {gaps.length > 0 && (
        <Link href="/driver/profile#vehicle-insurance" className="block rounded-xl p-3 border bg-blue-50 border-blue-200 text-blue-900">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">Complete your profile</span>
          </div>
          <ul className="mt-1 ml-7 text-sm list-disc space-y-0.5">
            {gaps.map((g) => (
              <li key={g.group}>
                <span className="font-medium">{g.label}:</span> {g.missing.join(', ')}
              </li>
            ))}
          </ul>
          <p className="mt-1 ml-7 text-xs">
            {blocked
              ? 'Upload these to start getting new job offers. Dispatch reviews what you send.'
              : 'You can keep working while you finish these.'}
          </p>
        </Link>
      )}
    </div>
  );
}
