'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, X } from 'lucide-react';

/**
 * Dispatch in-page viewer (P-366): every photo and document a driver sent,
 * shown large on the same page, with Prev / Next (and the arrow keys) to
 * step through all of them and Esc to close. Files load through the
 * staff-only /api/documents/view route, which turns iPhone HEIC into JPEG,
 * so nothing downloads. "Open in new tab" is the fallback.
 */

export interface ViewerFile {
  /** Stable key (checklist item id, or e.g. 'license_front'). */
  key: string;
  path: string;
  label: string;
  /** Short status line under the label, e.g. "Waiting for review". */
  note?: string;
}

export function documentViewUrl(path: string): string {
  return `/api/documents/view?path=${encodeURIComponent(path)}`;
}

export function isPdfPath(path: string): boolean {
  return /\.pdf$/i.test(path);
}

export function DocumentViewer({
  files,
  index,
  onIndexChange,
  onClose,
  renderActions,
}: {
  files: ViewerFile[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Approve / reject etc. for the file shown, if it can be reviewed. */
  renderActions?: (file: ViewerFile) => ReactNode;
}) {
  const count = files.length;
  const file = files[Math.min(Math.max(index, 0), count - 1)];
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [file?.path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Typing a reject reason must not flip pages.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        if (e.key === 'Escape') (t as HTMLInputElement).blur();
        return;
      }
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && count > 1) onIndexChange((index - 1 + count) % count);
      else if (e.key === 'ArrowRight' && count > 1) onIndexChange((index + 1) % count);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, count, onClose, onIndexChange]);

  if (!file) return null;
  const src = documentViewUrl(file.path);
  const pdf = isPdfPath(file.path);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${file.label} (${index + 1} of ${count})`}
      className="fixed inset-0 z-50 flex flex-col bg-black/85"
      onClick={onClose}
    >
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.label}</p>
          <p className="text-xs text-gray-300">
            {index + 1} of {count}
            {file.note ? ` - ${file.note}` : ''}
          </p>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs inline-flex items-center px-2.5 py-1.5 rounded border border-white/30 hover:bg-white/10"
        >
          Open in new tab <ExternalLink className="h-3 w-3 ml-1" />
        </a>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-14 pb-2">
        {count > 1 && (
          <button
            type="button"
            aria-label="Previous file"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index - 1 + count) % count);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div className="max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {failed ? (
            <div className="text-center text-white">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-70" />
              <p className="text-sm">This file could not be shown here.</p>
              <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                Open it in a new tab
              </a>
            </div>
          ) : pdf ? (
            <iframe key={src} src={src} title={file.label} className="w-[min(90vw,900px)] h-[80vh] bg-white rounded" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={file.label}
              onError={() => setFailed(true)}
              className="max-w-full max-h-[78vh] object-contain rounded bg-white/5"
            />
          )}
        </div>
        {count > 1 && (
          <button
            type="button"
            aria-label="Next file"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index + 1) % count);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {renderActions && (
        <div className="px-4 pb-4 flex justify-center" onClick={(e) => e.stopPropagation()}>
          {renderActions(file)}
        </div>
      )}
    </div>
  );
}

/** Small clickable preview that opens the viewer. PDFs show an icon. */
export function DocumentThumb({ path, label, onOpen }: { path: string; label: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const pdf = isPdfPath(path);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`View ${label}`}
      className="w-12 h-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200 hover:ring-2 hover:ring-epyc-primary"
    >
      {pdf || failed ? (
        <span className="text-[10px] font-medium text-gray-600 flex flex-col items-center">
          <FileText className="h-4 w-4" />
          {pdf ? 'PDF' : 'View'}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={documentViewUrl(path)} alt={label} loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      )}
    </button>
  );
}
