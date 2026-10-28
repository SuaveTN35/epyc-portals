/**
 * Browser-side document upload for driver applications.
 *
 * Why this exists: uploads go through /api/upload on Vercel, and Vercel rejects
 * any request body over 4.5 MB before our code runs. Modern phone photos are
 * often 5-12 MB, so applicants' license, insurance, and vehicle photos failed.
 * Every file stored before this fix is under 4.4 MB, which is that wall.
 *
 * The fix: shrink photos in the browser first (max 2000 px on the long side,
 * JPEG), which also turns iPhone HEIC photos into JPEGs any browser can show.
 * PDFs are sent as-is and must fit under the limit.
 */

/** Stay safely under Vercel's 4.5 MB request body limit (form overhead included). */
import { isHeicFile } from './driver-profile';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const MAX_DIMENSION = 2000;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/i;

export function isImageFile(file: File): boolean {
  // Some iPhone and Android pickers report an empty type; fall back to the name.
  return file.type.startsWith('image/') || (!file.type && IMAGE_EXTENSIONS.test(file.name));
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      // Fall through to the <img> path (older Safari, some HEIC files).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Returns a JPEG no larger than MAX_DIMENSION on its long side. If the browser
 * cannot decode the image (for example HEIC on some Android browsers), the
 * original file is returned and the size check in uploadDriverDocument decides.
 */
export async function shrinkImage(file: File): Promise<File> {
  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await loadImage(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source && typeof source.close === 'function') source.close();

  let blob: Blob | null = null;
  for (const quality of [0.82, 0.7, 0.55]) {
    blob = await canvasToJpeg(canvas, quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
  }
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export class UploadError extends Error {}

/**
 * Shrinks (if a photo), uploads to /api/upload, and returns the storage path.
 * Throws UploadError with a message written for the applicant.
 */
export async function uploadDriverDocument(
  file: File,
  path: string,
  { allowPdf }: { allowPdf: boolean }
): Promise<{ path: string; file: File }> {
  const pdf = isPdfFile(file);
  if (!isImageFile(file) && !(allowPdf && pdf)) {
    throw new UploadError(
      allowPdf ? 'Please choose a photo or a PDF.' : 'Please choose a photo (JPG, PNG, or iPhone photo).'
    );
  }

  const prepared = pdf ? file : await shrinkImage(file);

  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      pdf
        ? 'This PDF is too large (over 4 MB). Take a photo of the document instead.'
        : 'This photo is too large to send. Please take a new photo or choose a screenshot.'
    );
  }

  const body = new FormData();
  body.append('file', prepared);
  body.append('path', path);

  let res: Response;
  try {
    res = await fetch('/api/upload', { method: 'POST', body });
  } catch {
    // One retry for a dropped mobile connection.
    try {
      res = await fetch('/api/upload', { method: 'POST', body });
    } catch {
      throw new UploadError('Upload failed. Check your signal and try again.');
    }
  }

  // Vercel answers an oversized request with plain text, not JSON.
  let data: { path?: string; url?: string; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    // keep data empty
  }

  if (!res.ok) {
    if (res.status === 413) {
      throw new UploadError('This file is too large. Please take a new photo and try again.');
    }
    if (res.status === 429) {
      throw new UploadError('Too many uploads at once. Wait a minute and try again.');
    }
    throw new UploadError(data.error || 'Upload failed. Please try again.');
  }

  const storedPath = data.path ?? data.url;
  if (!storedPath) {
    throw new UploadError('Upload failed. Please try again.');
  }
  return { path: storedPath, file: prepared };
}

/**
 * P-366: shrinks (if a photo) and uploads a driver profile item to
 * /api/driver/profile/upload, which stores it in the caller's own folder.
 * record=true also saves it on the driver's profile as 'pending' (profile
 * retakes); onboarding passes record=false and saves the paths on submit.
 */
export async function uploadProfileItemPhoto(
  file: File,
  item: string,
  { allowPdf, record }: { allowPdf: boolean; record: boolean }
): Promise<{ path: string; file: File }> {
  const pdf = isPdfFile(file);
  if (!isImageFile(file) && !(allowPdf && pdf)) {
    throw new UploadError(
      allowPdf ? 'Please choose a photo or a PDF.' : 'Please choose a photo (JPG, PNG, or iPhone photo).'
    );
  }
  let prepared = pdf ? file : await shrinkImage(file);
  // QA N4: shrinkImage returns the original when the browser cannot decode
  // it (HEIC on many Android and desktop browsers). The upload route turns a
  // HEIC into a JPEG on the server, so send it with a HEIC type; the route
  // answers with HEIC_MESSAGE only if it cannot convert it either.
  if (!pdf && prepared === file && isHeicFile(file)) {
    prepared = new File([file], file.name, { type: file.type || 'image/heic' });
  }
  if (!pdf && !prepared.type) {
    prepared = new File([prepared], prepared.name, { type: 'image/jpeg' });
  }
  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      pdf
        ? 'This PDF is too large (over 4 MB). Take a photo of the document instead.'
        : 'This photo is too large to send. Please take a new photo.'
    );
  }

  const body = new FormData();
  body.append('file', prepared);
  body.append('item', item);
  if (record) body.append('record', '1');

  let res: Response;
  try {
    res = await fetch('/api/driver/profile/upload', { method: 'POST', body });
  } catch {
    throw new UploadError('Upload failed. Check your signal and try again.');
  }
  let data: { path?: string; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    // keep empty
  }
  if (!res.ok || !data.path) {
    if (res.status === 413) throw new UploadError('This file is too large. Please take a new photo and try again.');
    if (res.status === 429) throw new UploadError('Too many uploads at once. Wait a minute and try again.');
    throw new UploadError(data.error || 'Upload failed. Please try again.');
  }
  return { path: data.path, file: prepared };
}
