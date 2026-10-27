'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyButton({
  value,
  label,
  className = '',
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium touch-target ${className}`}
    >
      {state === 'copied' ? (
        <Check className="h-4 w-4 mr-1 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 mr-1" />
      )}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
}
