'use client';

import { useState, useRef } from 'react';
import { Upload, X, Check, Loader2, Camera, FileText, Image } from 'lucide-react';
import { uploadDriverDocument, isImageFile } from '@/lib/upload-client';

interface DocumentUploadProps {
  label: string;
  description?: string;
  bucket: string;
  path: string;
  currentUrl?: string | null;
  onUploadComplete: (url: string) => void;
  accept?: string;
  icon?: 'camera' | 'file' | 'image';
}

export default function DocumentUpload({
  label,
  description,
  // `bucket` is accepted for API compatibility with existing call sites but is
  // no longer used: uploads now go through the service-role /api/upload route,
  // which targets the driver-documents bucket and bypasses storage RLS.
  path,
  currentUrl,
  onUploadComplete,
  accept = 'image/*,application/pdf',
  icon = 'camera',
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const IconComponent = icon === 'camera' ? Camera : icon === 'file' ? FileText : Image;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      // Photos are shrunk in the browser before upload (see lib/upload-client),
      // which keeps them under Vercel's 4.5 MB request limit.
      const { path: storedPath, file: sent } = await uploadDriverDocument(file, path, {
        allowPdf: accept.includes('pdf'),
      });

      if (isImageFile(sent)) {
        setPreview(URL.createObjectURL(sent));
      } else {
        setPreview('pdf');
      }

      // Storage path, not a public URL. The driver-documents bucket is private.
      onUploadComplete(storedPath);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err?.message || 'Upload failed. Please try again.');
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview ? (
        <div className="relative">
          <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
            {preview.startsWith('blob:') || preview.startsWith('data:image') ? (
              <img
                src={preview}
                alt={label}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="h-16 w-16 text-gray-400" />
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={handleRemove}
                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute bottom-2 right-2">
              <span className="inline-flex items-center px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                <Check className="h-3 w-3 mr-1" />
                Uploaded
              </span>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-epyc-green hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 text-epyc-green animate-spin mb-2" />
              <span className="text-sm text-gray-600">Uploading...</span>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <IconComponent className="h-7 w-7 text-gray-400" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Tap to upload {label.toLowerCase()}
              </span>
              <span className="text-xs text-gray-500 mt-1">
                Take a photo or choose a file
              </span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
