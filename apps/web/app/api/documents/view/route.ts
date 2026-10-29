import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { getCallerStaff } from '@/lib/server/staff-session';
import { isAllowedDocumentPath } from '@/lib/server/document-paths';
import { DOCUMENT_CONTENT_TYPES, sniffDocumentType } from '@/lib/document-sniff';
import { heicToJpeg, HeicConvertError } from '@/lib/server/heic';

/**
 * GET /api/documents/view?path=<storage path>
 *
 * Staff only (admin / dispatcher, same check as the review route). Streams one
 * file from the private driver-documents bucket so the dispatch viewer can
 * show it on the page instead of downloading it (P-366).
 *   * The path must be a plain storage path in a known folder (same rule as
 *     signed-url): no ".", "..", "%", or empty segments that fetch would
 *     rewrite into a different file.
 *   * The type is read from the file's first bytes, never from its name or
 *     stored content type. Only JPEG, PNG, GIF, WEBP, PDF, and HEIC are
 *     served; anything else is refused (415), so an uploaded HTML or SVG can
 *     never run on this origin.
 *   * iPhone HEIC / HEIF is converted to JPEG on the fly, only after its
 *     declared size passes the pixel cap (heicToJpeg).
 *   * Always Content-Disposition: inline; images also get a sandbox CSP.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

// The viewer and the panel thumbnails both load through here.
const VIEW_RATE = { limit: 120, windowSeconds: 60 };

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(`documents-view:${getClientIdentifier(request)}`, VIEW_RATE);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });

  const caller = await getCallerStaff();
  if (!caller) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const path = request.nextUrl.searchParams.get('path');
  if (!isAllowedDocumentPath(path)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  const { data, error } = await caller.admin.storage.from('driver-documents').download(path);
  if (error || !data) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  let bytes: Uint8Array = new Uint8Array(await data.arrayBuffer());
  let kind = sniffDocumentType(bytes);
  if (!kind) return NextResponse.json({ error: 'This file type cannot be shown' }, { status: 415 });

  if (kind === 'heic') {
    try {
      bytes = await heicToJpeg(bytes);
      kind = 'jpeg';
    } catch (e) {
      console.error('[documents/view] HEIC conversion failed', { message: e instanceof HeicConvertError ? e.message : 'unknown' });
      return NextResponse.json({ error: 'This iPhone photo could not be converted for viewing' }, { status: 422 });
    }
  }

  const baseName = (path.split('/').pop() || 'file').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]/g, '_');
  const ext = kind === 'jpeg' ? 'jpg' : kind;
  const headers: Record<string, string> = {
    'Content-Type': DOCUMENT_CONTENT_TYPES[kind],
    'Content-Disposition': `inline; filename="${baseName}.${ext}"`,
    'Content-Length': String(bytes.byteLength),
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  // PDFs get no sandbox CSP (AEQUALIS QA item 4, decided 2026-10-28): Chrome
  // does not render a PDF whose response carries a CSP sandbox, and adding
  // "allow-scripts allow-same-origin" to make it render would cancel the
  // sandbox for a same-origin document anyway. A PDF is served only when its
  // bytes start with %PDF, as application/pdf with nosniff, to staff only,
  // so the browser hands it to its PDF viewer and never runs it as a page.
  if (kind !== 'pdf') headers['Content-Security-Policy'] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";

  return new NextResponse(Buffer.from(bytes), { status: 200, headers });
}
