// Test fixtures only (vitest). A real 64 x 48 HEIC, and the same file with
// its declared size (ispe) raised to 20000 x 20000 to exercise the decode cap.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function sampleHeic(): Uint8Array {
  return new Uint8Array(readFileSync(join(__dirname, 'sample.heic')));
}

export function oversizeHeic(): Uint8Array {
  const b = sampleHeic();
  const at = Buffer.from(b).indexOf('ispe');
  if (at < 0) throw new Error('fixture has no ispe box');
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // type at `at`, then 4 bytes version/flags, then width and height.
  v.setUint32(at + 8, 20000);
  v.setUint32(at + 12, 20000);
  return b;
}
