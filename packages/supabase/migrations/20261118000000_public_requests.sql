-- ============================================
-- PUBLIC REQUESTS + DRIVER APPLICATION ANSWERS (2026-11-18)
-- ============================================
-- Lets a visitor ask for a delivery or send a message without an account, and
-- records three screening answers and an optional resume on driver applications.
--
-- ADDITIVE / SAFE TO RE-RUN: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS, DROP POLICY IF EXISTS before CREATE POLICY. Nothing is dropped or
-- deleted. Depends on 20261027000000_phase0_security_lockdown.sql
-- (caller_is_staff(), handle_new_user()).
--
-- Writes to the two new tables come only from the server routes
-- /api/public/delivery-request and /api/public/contact, which use the service
-- role. The browser (anon or signed-in) has no insert, read, or delete policy.
-- Staff (admin or dispatcher) can read and update them in the dispatch portal.
--
-- BEFORE APPLYING: section 4 re-creates public.handle_new_user(). Its body is
-- the phase0 version plus four fields. Check the live function still matches
-- phase0 first:  select pg_get_functiondef('public.handle_new_user'::regproc);

-- --------------------------------------------
-- 1. delivery_requests: "Request a delivery" form on the public site
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE
    DEFAULT ('REQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'quoted', 'booked', 'declined', 'spam')),
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  company_name text,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  item_type text NOT NULL
    CHECK (item_type IN ('medical', 'legal', 'commercial', 'other')),
  item_description text,
  service_level text NOT NULL DEFAULT 'same_day'
    CHECK (service_level IN ('asap', 'same_day', 'scheduled')),
  pickup_date date,
  time_window text,
  notes text,
  staff_notes text,
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_at timestamptz,
  source text NOT NULL DEFAULT 'web_request',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_requests_status_created_idx
  ON public.delivery_requests (status, created_at DESC);

ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_requests_staff_select ON public.delivery_requests;
CREATE POLICY delivery_requests_staff_select ON public.delivery_requests
  FOR SELECT TO authenticated
  USING (public.caller_is_staff());

DROP POLICY IF EXISTS delivery_requests_staff_update ON public.delivery_requests;
CREATE POLICY delivery_requests_staff_update ON public.delivery_requests
  FOR UPDATE TO authenticated
  USING (public.caller_is_staff())
  WITH CHECK (public.caller_is_staff());

-- --------------------------------------------
-- 2. contact_messages: "Send us a message" form on /contact
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'replied', 'closed', 'spam')),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text NOT NULL DEFAULT 'other',
  message text NOT NULL,
  staff_notes text,
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_messages_status_created_idx
  ON public.contact_messages (status, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_messages_staff_select ON public.contact_messages;
CREATE POLICY contact_messages_staff_select ON public.contact_messages
  FOR SELECT TO authenticated
  USING (public.caller_is_staff());

DROP POLICY IF EXISTS contact_messages_staff_update ON public.contact_messages;
CREATE POLICY contact_messages_staff_update ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (public.caller_is_staff())
  WITH CHECK (public.caller_is_staff());

-- --------------------------------------------
-- 3. driver_applications: screening answers and resume
-- --------------------------------------------
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS van_access text;
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS years_experience text;
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS availability text;
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS resume_path text;

-- --------------------------------------------
-- 4. handle_new_user(): phase0 body, plus the four fields above
-- --------------------------------------------
-- The four answers come from signup metadata, which the browser controls, so
-- each is checked against a short allowlist and anything else is stored as
-- null. resume_path must be a plain "resumes/<file>" storage path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_phone text;
  v_bucket_prefix text := 'https://frdawxvsqckinanypenj.supabase.co/storage/v1/object/public/driver-documents/';
  v_van text;
  v_exp text;
  v_avail text;
  v_resume text;
begin
  v_role := lower(nullif(trim(new.raw_user_meta_data->>'role'), ''));
  -- Staff roles (admin, dispatcher, staff) are granted only by an admin,
  -- never by signup metadata, which the browser controls.
  if v_role is null or v_role not in ('driver','client','customer','member') then
    v_role := 'member';
  end if;
  v_phone := nullif(trim(new.raw_user_meta_data->>'phone'), '');

  insert into public.profiles (id, email, full_name, avatar_url, role, phone)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email),
    new.raw_user_meta_data->>'avatar_url',
    v_role,
    v_phone
  )
  on conflict (id) do nothing;

  -- A driver signup is an application. Create it here so nothing depends on the
  -- client finishing a second request.
  if v_role = 'driver' then
    v_van := new.raw_user_meta_data->>'van_access';
    if v_van is null or v_van not in ('own_van', 'can_rent_van', 'no_van') then
      v_van := null;
    end if;
    v_exp := new.raw_user_meta_data->>'years_experience';
    if v_exp is null or v_exp not in ('none', 'under_1', '1_to_3', 'over_3') then
      v_exp := null;
    end if;
    v_avail := new.raw_user_meta_data->>'availability';
    if v_avail is null or v_avail not in ('full_time', 'part_time', 'weekends') then
      v_avail := null;
    end if;
    v_resume := new.raw_user_meta_data->>'resume_path';
    if v_resume is null or v_resume !~ '^resumes/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$' then
      v_resume := null;
    end if;

    insert into public.driver_applications (
      profile_id, full_name, email, phone, status,
      profile_photo_path, license_front_path, license_back_path, source,
      van_access, years_experience, availability, resume_path
    )
    values (
      new.id,
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      new.email,
      v_phone,
      'pending_review',
      replace(new.raw_user_meta_data->>'profile_photo_url', v_bucket_prefix, ''),
      replace(new.raw_user_meta_data->>'drivers_license_front_url', v_bucket_prefix, ''),
      replace(new.raw_user_meta_data->>'drivers_license_back_url', v_bucket_prefix, ''),
      'web_register',
      v_van,
      v_exp,
      v_avail,
      v_resume
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$function$;
