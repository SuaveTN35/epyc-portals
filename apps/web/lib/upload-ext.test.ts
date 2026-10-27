import { describe, it, expect } from 'vitest';
import { extensionForContentType } from './upload-ext';

describe('extensionForContentType', () => {
  it('maps known types', () => {
    expect(extensionForContentType('application/pdf')).toBe('pdf');
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
    expect(extensionForContentType('IMAGE/PNG')).toBe('png');
    expect(extensionForContentType('image/heic')).toBe('heic');
  });
  it('never echoes a client extension', () => {
    expect(extensionForContentType('image/x-unknown')).toBe('img');
    expect(extensionForContentType('text/html')).toBe('bin');
  });
});
