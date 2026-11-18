import { describe, expect, it } from 'vitest';
import { trackingLink, verifyTrackingSignature } from './tracking-link';

const ID = '3f2a9c1e-1111-4222-8333-944455556666';
const env = { CLIENT_TRACKING_SECRET: 'a'.repeat(40) };

describe('tracking links', () => {
  it('makes a link that verifies for the same job only', () => {
    const link = trackingLink(ID, env);
    expect(link).toMatch(new RegExp(`^https://www\\.epyccs\\.com/track/${ID}/[A-Za-z0-9_-]{22}$`));
    const sig = link!.split('/').pop()!;
    expect(verifyTrackingSignature(ID, sig, env)).toBe(true);
    expect(verifyTrackingSignature(ID.toUpperCase(), sig, env)).toBe(true);
    expect(verifyTrackingSignature('3f2a9c1e-1111-4222-8333-944455556667', sig, env)).toBe(false);
  });

  it('rejects a changed or malformed signature', () => {
    const sig = trackingLink(ID, env)!.split('/').pop()!;
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(verifyTrackingSignature(ID, flipped, env)).toBe(false);
    expect(verifyTrackingSignature(ID, sig.slice(1), env)).toBe(false);
    expect(verifyTrackingSignature(ID, `${sig}/../x`, env)).toBe(false);
  });

  it('a different secret makes a different link', () => {
    const other = { CLIENT_TRACKING_SECRET: 'b'.repeat(40) };
    expect(trackingLink(ID, env)).not.toBe(trackingLink(ID, other));
    const sig = trackingLink(ID, env)!.split('/').pop()!;
    expect(verifyTrackingSignature(ID, sig, other)).toBe(false);
  });

  it('makes no link and accepts nothing without a strong secret', () => {
    expect(trackingLink(ID, {})).toBeNull();
    expect(trackingLink(ID, { CLIENT_TRACKING_SECRET: 'short' })).toBeNull();
    expect(verifyTrackingSignature(ID, 'anything', {})).toBe(false);
    expect(trackingLink('not-a-uuid', env)).toBeNull();
  });
});
