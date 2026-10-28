// Server-only: iPhone HEIC / HEIF to JPEG (P-366). Chrome and most desktop
// browsers cannot show HEIC, so dispatch saw a download instead of a photo.
// heic-convert is pure JS + WASM (no native build), loaded on first use so
// it stays out of every other route's bundle.

const JPEG_QUALITY = 0.85;

export class HeicConvertError extends Error {}

export async function heicToJpeg(bytes: Uint8Array): Promise<Buffer> {
  const { default: convert } = await import('heic-convert');
  try {
    const out = await convert({ buffer: Buffer.from(bytes), format: 'JPEG', quality: JPEG_QUALITY });
    return Buffer.from(new Uint8Array(out));
  } catch (e) {
    throw new HeicConvertError(e instanceof Error ? e.message : 'HEIC conversion failed');
  }
}
