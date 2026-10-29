// Server-only: iPhone HEIC / HEIF to JPEG (P-366). Chrome and most desktop
// browsers cannot show HEIC, so dispatch saw a download instead of a photo.
// heic-convert is pure JS + WASM (no native build), loaded on first use so
// it stays out of every other route's bundle.

const JPEG_QUALITY = 0.85;

import { heicDecodeRefusal } from '@/lib/document-sniff';

export class HeicConvertError extends Error {}

/**
 * Converts after checking the size the file declares (ispe): a file over
 * HEIC_MAX_PIXELS, or one whose size cannot be read, is refused before any
 * decoding, so a small crafted upload cannot make the server allocate a huge
 * image. Every caller (view route, both upload routes) goes through here.
 */
export async function heicToJpeg(bytes: Uint8Array): Promise<Buffer> {
  const refusal = heicDecodeRefusal(bytes);
  if (refusal) throw new HeicConvertError(refusal);
  const { default: convert } = await import('heic-convert');
  try {
    const out = await convert({ buffer: Buffer.from(bytes), format: 'JPEG', quality: JPEG_QUALITY });
    return Buffer.from(new Uint8Array(out));
  } catch (e) {
    throw new HeicConvertError(e instanceof Error ? e.message : 'HEIC conversion failed');
  }
}
