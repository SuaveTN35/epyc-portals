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

// Control characters (C0, DEL, C1).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * A storage path that can only mean itself. storage-js does not encode the
 * path, and fetch normalizes the URL, so "drivers/p/./x.jpg" or
 * "drivers/p/z/%2e%2e/x.jpg" would reach "drivers/p/x.jpg" while passing a
 * prefix or pattern check (AEQUALIS QA, P-366). Refused: a leading "/", any
 * empty, "." or ".." segment, any "%", any backslash, any control character.
 */
export function isSafeStoragePath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > 512) return false;
  if (path.startsWith('/') || path.includes('%') || path.includes('\\') || CONTROL_CHARS.test(path)) return false;
  return path.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

export function isAllowedDocumentPath(path: unknown): path is string {
  return isSafeStoragePath(path) && ALLOWED_DOCUMENT_PREFIXES.some((prefix) => path.startsWith(prefix));
}
