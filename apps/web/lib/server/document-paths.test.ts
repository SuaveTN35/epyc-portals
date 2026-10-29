import { describe, it, expect } from 'vitest';
import { isAllowedDocumentPath, isSafeStoragePath } from './document-paths';

// Every path shape the app creates or has stored (live bucket: 454 of 454 match).
const REAL = [
  'drivers/0b7e5c1e-3f2a-4c55-9d1e-2a6f0c9b7d11/vehicle_front-1761600000000-ab12cd.jpg',
  'drivers/0b7e5c1e-3f2a-4c55-9d1e-2a6f0c9b7d11/insurance_card-1761600000000-ab12cd.pdf',
  'drivers/0b7e5c1e-3f2a-4c55-9d1e-2a6f0c9b7d11/id_badge_photo-1761600000000-ab12cd.jpg',
  'profile-photos/1761600000000-x7k2qa.jpg',
  'license-front/1761600000000-x7k2qa.heic',
  'license-back/1761600000000-x7k2qa.png',
  'licenses/1761600000000-x7k2qa.webp',
  'insurance/1761600000000-x7k2qa.pdf',
  'registration/1761600000000-x7k2qa.jpg',
  'vehicles/1761600000000-x7k2qa.img',
];

// Everything fetch or storage could read as a different file (AEQUALIS QA).
const BAD_PATHS = [
  'drivers/P1/./x.jpg',
  'drivers/P1/z/../x.jpg',
  'drivers/P1/z/%2e%2e/x.jpg',
  'drivers/P1/z/%2E%2E/x.jpg',
  'drivers//x.jpg',
  '/drivers/P1/x.jpg',
  'drivers/P1/x.jpg/',
  'drivers\\P1\\x.jpg',
  'drivers/P1/x.jpg\u0000',
  'drivers/P1/x.jpg?/y',
  'drivers/P1/x.jpg#/y',
  'drivers/P1/x.jpg?download=1',
  'drivers/P1/my photo.jpg',
  'drivers/P1/fotó.jpg',
  'drivers/P1/х.jpg',
  'drivers/P1/.hidden.jpg',
  'drivers/P1/-x.jpg',
  `drivers/P1/${'a'.repeat(600)}.jpg`,
  '',
];

describe('isSafeStoragePath (allowlist)', () => {
  it('accepts every real path shape', () => {
    for (const p of REAL) {
      expect(isSafeStoragePath(p), p).toBe(true);
      expect(isAllowedDocumentPath(p), p).toBe(true);
    }
  });
  it('refuses dot segments, encoding, query, fragment, spaces, unicode, and the rest', () => {
    for (const p of BAD_PATHS) expect(isSafeStoragePath(p), JSON.stringify(p)).toBe(false);
    for (const p of [null, undefined, 42, {}]) expect(isSafeStoragePath(p)).toBe(false);
  });
  it('still needs a known folder', () => {
    expect(isAllowedDocumentPath('secrets/x.jpg')).toBe(false);
  });
});
