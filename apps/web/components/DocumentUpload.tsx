'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, X, Check, Loader2, Camera, FileText, Image } from 'lucide-react';

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
  bucket,
  path,
  currentUrl,
  onUploadComplete,
  accept = 'image/*',
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      setError('Please upload an image or PDF file');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const supabase = createClient();

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${path}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onUploadComplete(urlData.publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
      setPreview(null);
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
            {preview.startsWith('data:image') || preview.includes('supabase') ? (
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
                JPG, PNG or PDF up to 10MB
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
