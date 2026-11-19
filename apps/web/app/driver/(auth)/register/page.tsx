'use client';

import { Suspense, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, User, Phone, ArrowRight, Loader2, Car, CheckCircle, Camera, CreditCard, Upload, X } from 'lucide-react';
import { uploadDriverDocument, isImageFile, isPdfFile } from '@/lib/upload-client';
import { VAN_ACCESS, EXPERIENCE, AVAILABILITY } from '@/lib/public-requests';
import Turnstile, { TURNSTILE_SITE_KEY } from '@/components/public/Turnstile';

function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const licenseFrontRef = useRef<HTMLInputElement>(null);
  const licenseBackRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    van_access: '',
    years_experience: '',
    availability: '',
  });

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [licenseFront, setLicenseFront] = useState<File | null>(null);
  const [licenseFrontPreview, setLicenseFrontPreview] = useState<string | null>(null);
  const [licenseBack, setLicenseBack] = useState<File | null>(null);
  const [licenseBackPreview, setLicenseBackPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      // Photos are shrunk before upload (lib/upload-client), so a large phone
      // photo is fine here. Only reject files that are not photos at all.
      if (!isImageFile(file)) {
        setError('Please choose a photo (JPG, PNG, or iPhone photo).');
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

  const uploadFile = async (_supabase: ReturnType<typeof createClient>, file: File, path: string): Promise<string> => {
    try {
      // Storage path, not a public URL. The bucket is private.
      const { path: storedPath } = await uploadDriverDocument(file, path, { allowPdf: false });
      return storedPath;
    } catch (err) {
      const label =
        path === 'profile-photos'
          ? 'profile photo'
          : path === 'license-front'
            ? "driver's license (front)"
            : "driver's license (back)";
      throw new Error(`Your ${label} did not upload. ${err instanceof Error ? err.message : 'Please try again.'}`);
    }
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

    // Validate required files. A photo of the applicant is NOT required at
    // application (2 CCR 11016(c)(2); TRIBUNAL P-367 R1): it is optional here,
    // and the ID badge photo is collected after approval. No software ever
    // compares it to the license or any other photo.
    if (!formData.van_access || !formData.years_experience || !formData.availability) {
      setError('Please answer the three questions about your van, experience, and availability');
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
      let profilePhotoUrl: string | null = null;
      if (profilePhoto) {
        setUploadProgress('Uploading photo...');
        profilePhotoUrl = await uploadFile(supabase, profilePhoto, 'profile-photos');
      }

      setUploadProgress("Uploading driver's license (front)...");
      const licenseFrontUrl = await uploadFile(supabase, licenseFront, 'license-front');

      setUploadProgress("Uploading driver's license (back)...");
      const licenseBackUrl = await uploadFile(supabase, licenseBack, 'license-back');

      // Resume is optional. A failed resume upload must not lose the application.
      let resumePath: string | null = null;
      if (resume) {
        setUploadProgress('Uploading resume...');
        try {
          resumePath = (await uploadDriverDocument(resume, 'resumes', { allowPdf: true })).path;
        } catch (resumeErr) {
          console.error('Resume upload failed:', resumeErr);
        }
      }

      setUploadProgress('Creating your account...');

      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          // Send the verification link back through our callback so a verified
          // driver lands on onboarding instead of the marketing home page.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/driver/onboarding`,
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: 'driver',
            ...(profilePhotoUrl ? { profile_photo_url: profilePhotoUrl } : {}),
            drivers_license_front_url: licenseFrontUrl,
            drivers_license_back_url: licenseBackUrl,
            onboarding_status: 'documents_submitted',
            van_access: formData.van_access,
            years_experience: formData.years_experience,
            availability: formData.availability,
            ...(resumePath ? { resume_path: resumePath } : {}),
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Best effort. The application is already recorded by this point, so a
      // mail failure must never present as a failed submission.
      try {
        await fetch('/api/notify/driver-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            van_access: formData.van_access,
            years_experience: formData.years_experience,
            availability: formData.availability,
            has_resume: !!resumePath,
            turnstile_token: captcha,
          }),
        });
      } catch (notifyErr) {
        console.error('Application notification failed:', notifyErr);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
      setLoading(false);
      // Tokens are single use; get a fresh one before the next try.
      setCaptcha(null);
      setCaptchaRound((n) => n + 1);
    }
  };

  if (success) {
    return (
      <div className="bg-white py-8 px-6 shadow-xl rounded-xl text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Application Submitted</h3>
        <p className="text-gray-600 mb-4">
          We sent a confirmation to your email. Click the verification link in it to finish setting
          up your account and add your vehicle and insurance details.
        </p>
        <p className="text-gray-600 mb-6">
          Our team reviews your application and calls you within two business days. If you have not
          heard back, call or text Rico at{' '}
          <a href="tel:8182170070" className="text-epyc-primary font-semibold">
            (818) 217-0070
          </a>
          .
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
            Photo of you <span className="text-gray-500 font-normal">(optional)</span>
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
            <p className="text-xs text-gray-500 mt-2">
              Not required to apply, and not used to decide your application. You can skip this and add your ID badge
              photo after you are approved.
            </p>
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

        <p className="text-sm font-semibold text-gray-900">About your driving</p>
        <div>
          <label htmlFor="van_access" className="block text-sm font-medium text-gray-700">
            Do you have a cargo van?
          </label>
          <select id="van_access" name="van_access" required value={formData.van_access} onChange={handleChange} className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base bg-white">
            <option value="">Choose one</option>
            {VAN_ACCESS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="years_experience" className="block text-sm font-medium text-gray-700">
            Courier or delivery experience
          </label>
          <select id="years_experience" name="years_experience" required value={formData.years_experience} onChange={handleChange} className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base bg-white">
            <option value="">Choose one</option>
            {EXPERIENCE.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="availability" className="block text-sm font-medium text-gray-700">
            Availability
          </label>
          <select id="availability" name="availability" required value={formData.availability} onChange={handleChange} className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary text-base bg-white">
            <option value="">Choose one</option>
            {AVAILABILITY.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700">Resume (optional)</span>
          <p className="text-xs text-gray-500 mb-2">PDF or a photo, up to 4 MB.</p>
          {resume ? (
            <div className="flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <span className="truncate mr-2">{resume.name}</span>
              <button
                type="button"
                onClick={() => {
                  setResume(null);
                  if (resumeRef.current) resumeRef.current.value = '';
                }}
                className="text-gray-500 hover:text-red-600"
                aria-label="Remove resume"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => resumeRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-600 hover:border-epyc-primary flex items-center justify-center"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add resume
            </button>
          )}
          <input
            ref={resumeRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (f && !isPdfFile(f) && !isImageFile(f)) {
                setError('Resume must be a PDF or a photo.');
                return;
              }
              setResume(f);
              setError(null);
            }}
          />
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

        <Turnstile onToken={setCaptcha} resetKey={captchaRound} />

        <button
          type="submit"
          disabled={loading || (!!TURNSTILE_SITE_KEY && !captcha)}
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
