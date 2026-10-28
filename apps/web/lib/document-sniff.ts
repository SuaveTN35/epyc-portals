// What a stored driver document really is, read from its first bytes rather
// than from the name or the content type the browser claimed (P-366 viewer).
// Pure, so it is unit tested in document-sniff.test.ts.

export type DocumentKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf' | 'heic';

export const DOCUMENT_CONTENT_TYPES: Record<DocumentKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  heic: 'image/heic',
};

export const DOCUMENT_EXTENSIONS: Record<DocumentKind, string> = {
  jpeg: 'jpg',
  png: 'png',
  gif: 'gif',
  webp: 'webp',
  pdf: 'pdf',
  heic: 'heic',
};

// ISO-BMFF major brands used by iPhone HEIC / HEIF stills. AVIF ('avif')
// shares the container but is not HEIC, so it is not listed.
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** True for an iPhone HEIC / HEIF image (ftyp box with a HEIF brand). */
export function isHeicBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(bytes, 8, 12));
}

/** The kind of file, or null when it is none of the kinds we store and show. */
export function sniffDocumentType(bytes: Uint8Array): DocumentKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 4 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'png';
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === '%PDF') return 'pdf';
  if (isHeicBytes(bytes)) return 'heic';
  return null;
}
