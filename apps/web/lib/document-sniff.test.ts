import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isHeicBytes, sniffDocumentType } from './document-sniff';

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
