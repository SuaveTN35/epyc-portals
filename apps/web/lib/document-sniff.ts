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

// ---------------------------------------------------------------------------
// HEIC declared size (read before decoding; AEQUALIS QA, P-366)
// ---------------------------------------------------------------------------

/**
 * Largest image the server will decode from HEIC. iPhone "HEIF Max" photos
 * are 48 MP (8064 x 6048); anything bigger, or a file whose size cannot be
 * read, is refused before any decoding work starts.
 */
export const HEIC_MAX_PIXELS = 50_000_000;

interface Box {
  type: string;
  start: number; // first byte of the payload
  end: number; // one past the last byte
}

function* boxes(view: DataView, from: number, to: number): Generator<Box> {
  let pos = from;
  while (pos + 8 <= to) {
    let size = view.getUint32(pos);
    const type = String.fromCharCode(view.getUint8(pos + 4), view.getUint8(pos + 5), view.getUint8(pos + 6), view.getUint8(pos + 7));
    let header = 8;
    if (size === 1) {
      if (pos + 16 > to) return;
      const big = view.getBigUint64(pos + 8);
      if (big > BigInt(to - pos)) return;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = to - pos;
    }
    if (size < header || pos + size > to) return;
    yield { type, start: pos + header, end: pos + size };
    pos += size;
  }
}

function child(view: DataView, parent: Box, type: string, skip = 0): Box | null {
  for (const b of boxes(view, parent.start + skip, parent.end)) if (b.type === type) return b;
  return null;
}

/**
 * The largest image size declared in a HEIC / HEIF file (meta > iprp > ipco >
 * ispe boxes; a grid image's full size is one of them), or null when it
 * cannot be read. Reads the header only; nothing is decoded.
 */
export function heicDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isHeicBytes(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const file: Box = { type: 'file', start: 0, end: bytes.byteLength };
  const meta = child(view, file, 'meta');
  if (!meta) return null;
  // meta is a full box: 4 bytes of version + flags before its children.
  const iprp = child(view, meta, 'iprp', 4);
  const ipco = iprp ? child(view, iprp, 'ipco') : null;
  if (!ipco) return null;
  let best: { width: number; height: number } | null = null;
  for (const b of boxes(view, ipco.start, ipco.end)) {
    if (b.type !== 'ispe' || b.end - b.start < 12) continue;
    const width = view.getUint32(b.start + 4);
    const height = view.getUint32(b.start + 8);
    if (width === 0 || height === 0) continue;
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  return best;
}

/** Null when the HEIC may be decoded, else why not. */
export function heicDecodeRefusal(bytes: Uint8Array): string | null {
  const dims = heicDimensions(bytes);
  if (!dims) return 'HEIC image size could not be read';
  if (dims.width * dims.height > HEIC_MAX_PIXELS) return `HEIC image is too large (${dims.width} x ${dims.height})`;
  return null;
}
