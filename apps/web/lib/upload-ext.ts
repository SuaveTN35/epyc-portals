// Stored file extension for /api/upload, derived from the validated content
// type rather than the client-supplied file name.

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

export function extensionForContentType(contentType: string): string {
  const known = CONTENT_TYPE_EXTENSIONS[contentType.toLowerCase()];
  if (known) return known;
  // Any other image/* subtype: store as a generic image extension.
  return contentType.toLowerCase().startsWith('image/') ? 'img' : 'bin';
}
