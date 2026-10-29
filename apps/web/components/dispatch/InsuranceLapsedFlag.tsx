import { AlertTriangle } from 'lucide-react';
import { INSURANCE_LAPSED_FLAG } from '@/lib/driver-profile';

/** Red flag on an active job whose driver's insurance lapsed. Read only (no auto-reassign). */
export function InsuranceLapsedFlag({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold bg-red-600 text-white rounded ${className}`}
    >
      <AlertTriangle className="h-3 w-3" />
      {INSURANCE_LAPSED_FLAG}
    </span>
  );
}
