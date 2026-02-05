'use client';

import { Suspense, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, User, Phone, ArrowRight, Loader2, Car, CheckCircle, Camera, CreditCard, Upload, X } from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const licenseFrontRef = useRef<HTMLInputElement>(null);
  const licenseBackRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [licenseFront, setLicenseFront] = useState<File | null>(null);
  const [licenseFrontPreview, setLicenseFrontPreview] = useState<string | null>(null);
  const [licenseBack, setLicenseBack] = useState<File | null>(null);
  const [licenseBackPreview, setLicenseBackPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: File | null) => void,
    setPreview: (preview: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file (JPG, PNG, etc.)');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const removeFile = (
    setFile: (file: File | null) => void,
    setPreview: (preview: string | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const uploadFile = async (supabase: ReturnType<typeof createClient>, file: File, path: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('driver-documents')
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`Failed to upload ${path}: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('driver-documents')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUploadProgress(null);

    // Validate passwords
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    // Validate required files
    if (!profilePhoto) {
      setError('Profile photo is required');
      setLoading(false);
      return;
    }

    if (!licenseFront) {
      setError("Driver's license front photo is required");
      setLoading(false);
      return;
    }

    if (!licenseBack) {
      setError("Driver's license back photo is required");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      // Upload files first
      setUploadProgress('Uploading profile photo...');
      const profilePhotoUrl = await uploadFile(supabase, profilePhoto, 'profile-photos');

      setUploadProgress("Uploading driver's license (front)...");
      const licenseFrontUrl = await uploadFile(supabase, licenseFront, 'license-front');

      setUploadProgress("Uploading driver's license (back)...");
      const licenseBackUrl = await uploadFile(supabase, licenseBack, 'license-back');

      setUploadProgress('Creating your account...');

      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: 'driver',
            profile_photo_url: profilePhotoUrl,
            drivers_license_front_url: licenseFrontUrl,
            drivers_license_back_url: licenseBackUrl,
            onboarding_status: 'documents_submitted',
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white py-8 px-6 shadow-xl rounded-xl text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
        <p className="text-gray-600 mb-6">
          Please check your email to verify your account. Once verified, you'll be able to complete
          your driver onboarding.
        </p>
        <Link
          href="/driver/login"
          className="inline-flex items-center text-epyc-primary font-medium hover:text-epyc-secondary"
        >
          Go to Login
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white py-8 px-6 shadow-xl rounded-xl">
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              value={formData.full_name}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base"
              placeholder="John Doe"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base"
              placeholder="driver@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        {/* Profile Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profile Photo <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            {profilePhotoPreview ? (
              <div className="relative inline-block">
                <Image
                  src={profilePhotoPreview}
                  alt="Profile preview"
                  width={120}
                  height={120}
                  className="w-28 h-28 rounded-full object-cover border-4 border-epyc-primary"
                />
                <button
                  type="button"
                  onClick={() => removeFile(setProfilePhoto, setProfilePhotoPreview, profilePhotoRef)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => profilePhotoRef.current?.click()}
                className="flex flex-col items-center justify-center w-28 h-28 border-2 border-dashed border-gray-300 rounded-full hover:border-epyc-primary hover:bg-epyc-light transition-colors"
              >
                <Camera className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-gray-500 mt-1">Add Photo</span>
              </button>
            )}
            <input
              ref={profilePhotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, setProfilePhoto, setProfilePhotoPreview)}
            />
            <p className="text-xs text-gray-500 mt-2">Clear photo of your face. Max 5MB.</p>
          </div>
        </div>

        {/* Driver's License Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Driver&apos;s License <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">Upload clear photos of both sides of your valid driver&apos;s license.</p>

          <div className="grid grid-cols-2 gap-4">
            {/* Front of License */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Front</p>
              {licenseFrontPreview ? (
                <div className="relative">
                  <Image
                    src={licenseFrontPreview}
                    alt="License front preview"
                    width={200}
                    height={125}
                    className="w-full h-24 object-cover rounded-lg border-2 border-epyc-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(setLicenseFront, setLicenseFrontPreview, licenseFrontRef)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => licenseFrontRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-epyc-primary hover:bg-epyc-light transition-colors"
                >
                  <CreditCard className="h-6 w-6 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Front</span>
                </button>
              )}
              <input
                ref={licenseFrontRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, setLicenseFront, setLicenseFrontPreview)}
              />
            </div>

            {/* Back of License */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Back</p>
              {licenseBackPreview ? (
                <div className="relative">
                  <Image
                    src={licenseBackPreview}
                    alt="License back preview"
                    width={200}
                    height={125}
                    className="w-full h-24 object-cover rounded-lg border-2 border-epyc-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(setLicenseBack, setLicenseBackPreview, licenseBackRef)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => licenseBackRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-epyc-primary hover:bg-epyc-light transition-colors"
                >
                  <CreditCard className="h-6 w-6 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Back</span>
                </button>
              )}
              <input
                ref={licenseBackRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, setLicenseBack, setLicenseBackPreview)}
              />
            </div>
          </div>
        </div>

        <hr className="my-2" />

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base"
              placeholder="At least 8 characters"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              value={formData.confirm_password}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base"
              placeholder="Confirm your password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-epyc-primary hover:bg-epyc-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-epyc-primary disabled:opacity-50 disabled:cursor-not-allowed touch-target"
        >
          {loading ? (
            <div className="flex items-center">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">{uploadProgress || 'Processing...'}</span>
            </div>
          ) : (
            <>
              Apply to Drive
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          By applying, you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>
    </div>
  );
}

function RegisterFormFallback() {
  return (
    <div className="bg-white py-8 px-6 shadow-xl rounded-xl">
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    </div>
  );
}

export default function DriverRegisterPage() {
  return (
    <div className="min-h-screen bg-epyc-gradient flex flex-col justify-center py-12 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex flex-col items-center justify-center">
          <div className="bg-white p-3 rounded-xl mb-4">
            <Car className="h-10 w-10 text-epyc-primary" />
          </div>
          <span className="text-2xl font-bold text-white drop-shadow-md">Drive with EPYC</span>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-white drop-shadow-md">
          Start Earning Today
        </h2>
        <p className="mt-2 text-center text-sm text-white/90">
          Already a driver?{' '}
          <Link href="/driver/login" className="font-medium text-yellow-300 hover:text-yellow-200 underline">
            Sign in here
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<RegisterFormFallback />}>
          <RegisterForm />
        </Suspense>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-white/80 hover:text-white text-sm">
          ← Back to EPYC Courier
        </Link>
      </div>
    </div>
  );
}
