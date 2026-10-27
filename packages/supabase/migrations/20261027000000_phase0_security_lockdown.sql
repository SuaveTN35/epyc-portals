-- ============================================
-- PHASE 0 SECURITY LOCKDOWN (P-352, 2026-10-27)
-- ============================================
-- Closes three privilege-escalation paths found in the 2026-10-27 audit:
--   1. Signup accepted role 'admin' or 'dispatcher' from browser metadata.
--   2. Any signed-in user could change their own profiles.role.
--   3. A driver could edit their own approval, HIPAA, and stats fields.
-- The database is shared with the trust practice; is_admin() gates 18 tables,
-- so path 1 or 2 exposed far more than Epyc data.
--
-- "Staff" below means: the service role, a database superuser session, or a
-- signed-in profile with role admin or dispatcher.

-- --------------------------------------------
-- 1. Signup can never self-assign a staff role
-- --------------------------------------------
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
    insert into public.driver_applications (
      profile_id, full_name, email, phone, status,
      profile_photo_path, license_front_path, license_back_path, source
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
      'web_register'
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$function$;

-- --------------------------------------------
-- Shared helper: is the caller staff?
-- SECURITY INVOKER on purpose: current_user must be the real caller.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.caller_is_staff()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') then
    -- service_role, postgres, supabase_admin, or a SECURITY DEFINER trigger
    return true;
  end if;
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'dispatcher')
  );
end;
$function$;

-- --------------------------------------------
-- 2. Users cannot change their own role
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if new.role is distinct from old.role then
    if current_user not in ('authenticated', 'anon') then
      return new;
    end if;
    if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      return new;
    end if;
    -- The one self-service change: a customer/member becoming a driver applicant.
    if new.id = auth.uid()
       and new.role = 'driver'
       and old.role in ('member', 'customer', 'client') then
      return new;
    end if;
    raise exception 'Role changes require an administrator' using errcode = '42501';
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS guard_profile_role ON public.profiles;
CREATE TRIGGER guard_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- --------------------------------------------
-- 3. Drivers cannot approve or certify themselves
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_driver_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if public.caller_is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.background_check_status := 'pending';
    new.background_check_date := null;
    new.hipaa_certified := false;
    new.hipaa_cert_expiry := null;
    new.rating := 5.00;
    new.total_deliveries := 0;
    new.loyalty_tier := 'bronze';
    return new;
  end if;

  if new.background_check_status is distinct from old.background_check_status
     or new.background_check_date is distinct from old.background_check_date
     or new.hipaa_certified is distinct from old.hipaa_certified
     or new.hipaa_cert_expiry is distinct from old.hipaa_cert_expiry
     or new.rating is distinct from old.rating
     or new.total_deliveries is distinct from old.total_deliveries
     or new.loyalty_tier is distinct from old.loyalty_tier
     or new.profile_id is distinct from old.profile_id then
    raise exception 'Approval, certification, and rating fields are set by dispatch only'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS guard_driver_protected_fields ON public.drivers;
CREATE TRIGGER guard_driver_protected_fields
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_protected_fields();

-- --------------------------------------------
-- 4. Hygiene from the Supabase security advisor
-- --------------------------------------------
-- Trigger functions are not meant to be called over the REST API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_delivery_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_driver_stats() FROM PUBLIC, anon, authenticated;

-- Pin search_path on functions the advisor flagged. is_admin() keeps its
-- EXECUTE grants because RLS policies on 18 tables call it.
ALTER FUNCTION public.is_admin() SET search_path TO 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path TO 'public';
ALTER FUNCTION public.log_delivery_status_change() SET search_path TO 'public';
ALTER FUNCTION public.update_driver_stats() SET search_path TO 'public';
ALTER FUNCTION public.update_broker_updated_at() SET search_path TO 'public';
