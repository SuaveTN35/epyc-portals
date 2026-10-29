// Server-only: which storage paths in the private driver-documents bucket
// staff may open (signed links and the in-page viewer). Shared by
// /api/documents/signed-url and /api/documents/view so the rule is one place.

export const ALLOWED_DOCUMENT_PREFIXES = [
  'profile-photos/',
  'license-front/',
  'license-back/',
  'licenses/',
  'insurance/',
  'registration/',
  'vehicles/',
  // P-366: driver-owned folder drivers/<profile_id>/...
  'drivers/',
] as const;

// One path segment: starts with a letter or digit, then letters, digits,
// ".", "_", "-". So no "." / ".." segments, no "%", "?", "#", spaces,
// backslashes, control or non-ASCII characters.
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_PATH_LENGTH = 512;

/**
 * A storage path that can only mean itself (allowlist). storage-js does not
 * encode the path and fetch rewrites the URL: "./" and "%2e%2e" collapse, and
 * "?" or "#" cut the path short, so "drivers/p/x.jpg?/y" reaches
 * "drivers/p/x.jpg" while a prefix or pattern check sees something else
 * (AEQUALIS QA, P-366). Every segment must match SEGMENT, segments are joined
 * by single "/", no leading or trailing "/", at most 512 characters. Every
 * object in the live driver-documents bucket matches (454 of 454, checked
 * 2026-10-28), as do the paths both upload routes create.
 */
export function isSafeStoragePath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  return path.split('/').every((seg) => SEGMENT.test(seg));
}

export function isAllowedDocumentPath(path: unknown): path is string {
  return isSafeStoragePath(path) && ALLOWED_DOCUMENT_PREFIXES.some((prefix) => path.startsWith(prefix));
}
