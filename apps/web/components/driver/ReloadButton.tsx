'use client';

/** Reloads the page the driver was trying to open (the offline page is served at that URL). */
export function ReloadButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.location.reload()} className={className}>
      Refresh
    </button>
  );
}
