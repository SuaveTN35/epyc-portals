import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // This route is intentionally unauthenticated: applicants upload their
    // documents before an account exists. Rate limited so it cannot be used to
    // dump arbitrary files into the bucket.
    const rate = checkRateLimit(
      `upload:${getClientIdentifier(request)}`,
      RATE_LIMITS.quotes
    );
    if (!rate.success) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const path = formData.get('path') as string | null;

    if (!file || !path) {
      return NextResponse.json(
        { error: 'File and path are required' },
        { status: 400 }
      );
    }

    // Validate file type (images and PDFs - insurance cards and licenses are often PDFs)
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      return NextResponse.json(
        { error: 'Only image or PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Validate path (only allow known upload paths)
    const allowedPaths = [
      'profile-photos',
      'license-front',
      'license-back',
      'licenses',
      'insurance',
      'registration',
      'vehicles',
    ];
    if (!allowedPaths.includes(path)) {
      return NextResponse.json(
        { error: 'Invalid upload path' },
        { status: 400 }
      );
    }

    const fileExt = (file.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg')).toLowerCase();
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('driver-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // The driver-documents bucket is PRIVATE. Return the storage path, which is
    // what we persist; viewing is done through a short-lived signed URL issued to
    // staff. `url` is kept for backward compatibility with older clients but is
    // no longer publicly readable.
    return NextResponse.json({ path: fileName, url: fileName });
  } catch (err) {
    console.error('Upload route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
