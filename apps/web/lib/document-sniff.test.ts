import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEIC_MAX_PIXELS, heicDecodeRefusal, heicDimensions, isHeicBytes, sniffDocumentType } from './document-sniff';

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);
const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 24, ...text('ftyp'), ...text(brand), 0, 0, 0, 0]);

describe('sniffDocumentType', () => {
  it('reads the kind from the first bytes', () => {
    expect(sniffDocumentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniffDocumentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe('png');
    expect(sniffDocumentType(text('GIF89a'))).toBe('gif');
    expect(sniffDocumentType(text('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(sniffDocumentType(text('%PDF-1.7'))).toBe('pdf');
    expect(sniffDocumentType(ftyp('heic'))).toBe('heic');
  });
  it('refuses anything that could run on our origin or is unknown', () => {
    expect(sniffDocumentType(text('<html><script>x</script>'))).toBeNull();
    expect(sniffDocumentType(text('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffDocumentType(new Uint8Array())).toBeNull();
    expect(sniffDocumentType(bytes(0xff, 0xd8))).toBeNull();
  });
  it('detects a real iPhone-style HEIC file', () => {
    const real = new Uint8Array(readFileSync(join(__dirname, '__fixtures__/sample.heic')));
    expect(isHeicBytes(real)).toBe(true);
    expect(sniffDocumentType(real)).toBe('heic');
  });
});

describe('isHeicBytes', () => {
  it('accepts HEIF brands and rejects AVIF', () => {
    for (const b of ['heic', 'heix', 'mif1', 'msf1', 'hevc']) expect(isHeicBytes(ftyp(b))).toBe(true);
    expect(isHeicBytes(ftyp('avif'))).toBe(false);
    expect(isHeicBytes(ftyp('isom'))).toBe(false);
  });
});

// A minimal HEIF header: ftyp(heic) + meta(full box) > iprp > ipco > ispe boxes.
function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = new Uint8Array(payload.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of payload) {
    body.set(p, o);
    o += p.length;
  }
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(body, 8);
  return out;
}
function ispe(w: number, h: number) {
  const p = new Uint8Array(12);
  const v = new DataView(p.buffer);
  v.setUint32(4, w);
  v.setUint32(8, h);
  return box('ispe', p);
}
function heif(...props: Uint8Array[]) {
  const ftyp = box('ftyp', new TextEncoder().encode('heic'), new Uint8Array(4), new TextEncoder().encode('mif1heic'));
  const meta = box('meta', new Uint8Array(4), box('iprp', box('ipco', ...props)));
  const out = new Uint8Array(ftyp.length + meta.length);
  out.set(ftyp, 0);
  out.set(meta, ftyp.length);
  return out;
}

describe('heicDimensions / heicDecodeRefusal (decode cap)', () => {
  it('reads the size of a real HEIC without decoding it', () => {
    const real = new Uint8Array(readFileSync(join(__dirname, '__fixtures__/sample.heic')));
    expect(heicDimensions(real)).toEqual({ width: 64, height: 48 });
    expect(heicDecodeRefusal(real)).toBeNull();
  });
  it('takes the largest declared size (grid image vs tiles)', () => {
    expect(heicDimensions(heif(ispe(512, 512), ispe(8064, 6048), ispe(256, 256)))).toEqual({ width: 8064, height: 6048 });
    expect(heicDecodeRefusal(heif(ispe(8064, 6048)))).toBeNull(); // 48 MP iPhone HEIF Max is allowed
  });
  it('refuses a declared size over the cap', () => {
    expect(8064 * 6048).toBeLessThan(HEIC_MAX_PIXELS);
    expect(heicDecodeRefusal(heif(ispe(20000, 20000)))).toMatch(/too large/);
    expect(heicDecodeRefusal(heif(ispe(65535, 65535)))).toMatch(/too large/);
  });
  it('refuses when the size cannot be read', () => {
    expect(heicDecodeRefusal(heif())).toMatch(/could not be read/);
    expect(heicDecodeRefusal(ftypOnly())).toMatch(/could not be read/);
    const truncated = heif(ispe(100, 100)).slice(0, 40);
    expect(heicDecodeRefusal(truncated)).toMatch(/could not be read/);
    expect(heicDecodeRefusal(new TextEncoder().encode('not a heic at all'))).toMatch(/could not be read/);
  });
});

function ftypOnly() {
  return box('ftyp', new TextEncoder().encode('heic'), new Uint8Array(4));
}
