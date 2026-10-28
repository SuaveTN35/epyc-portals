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

export function isAllowedDocumentPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    !path.includes('..') &&
    ALLOWED_DOCUMENT_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}
