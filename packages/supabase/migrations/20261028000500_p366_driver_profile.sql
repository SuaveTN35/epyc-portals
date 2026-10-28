-- ============================================
-- DRIVER PROFILE: VEHICLE, INSURANCE, REGISTRATION, EQUIPMENT (P-366, 2026-10-28)
-- ============================================
-- What this adds:
--   1. drivers: insurance carrier, coverage limits, business-use answer,
--      registration expiry, a cargo-area photo, and cargo dimensions in
--      inches / capacity in pounds (new columns; the older vehicle_length/
--      width/height and cargo_capacity columns were captured in feet and
--      cubic feet and are left untouched).
--   2. driver_review_items: one row per driver per reviewable item (8
--      equipment photos, 4 vehicle photos, insurance card, registration,
--      cargo dimensions) with status pending / approved / rejected, the
--      reviewer, the time, and the rejection reason.
--   3. Guards (enforced by trigger, like Phase 0, not only by RLS):
--        * a driver can only create or change their own review rows, and
--          every driver write lands as 'pending' with reviewer fields cleared;
--          only staff can approve or reject, and a rejection needs a reason;
--        * a driver's new document/photo paths must sit in their own
--          storage folder drivers/<profile_id>/<file>;
--        * a driver cannot change vehicle type, make, model, year, plate, or
--          VIN after signup (dispatch changes those);
--        * when a driver changes insurance, registration, a vehicle photo, or
--          cargo dimensions, the matching review row goes back to 'pending'.
--   4. driver_offer_block_reason(driver_id): NULL when the driver may take
--      new work, else a plain reason. Blocked when there is no insurance
--      card, no insurance expiry, the expiry is before today (Pacific time),
--      or the insurance card review row is missing, pending, rejected, or
--      for a different file than the one on the driver record.
--      Checked on job_offers INSERT, on job_offers UPDATE to 'accepted', and
--      on deliveries INSERT/UPDATE that sets a (new) driver_id. Jobs already
--      assigned are never touched, so in-progress work can be finished.
--      Applies to every caller, staff and service role included.
--
-- Registration expiry and missing equipment / vehicle photos / dimensions do
-- NOT block work (Commander decision 2026-10-27: block on insurance only).
--
-- ADDITIVE / SAFE TO RE-RUN: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT
-- EXISTS, guarded constraints, CREATE OR REPLACE functions, DROP ... IF
-- EXISTS + CREATE for triggers and policies. No rows are changed or deleted.
-- No review rows are backfilled: existing insurance cards show in dispatch as
-- "not reviewed" until dispatch approves them.
--
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff())
-- and 20261027000100_phase1_dispatch_alignment.sql (drivers.status).
--
-- DEPLOY ORDER: apply this migration BEFORE the P-366 web code (the new
-- onboarding inserts the new columns). The old web code keeps working
-- against this schema, except that dispatch can no longer offer or assign
-- a job to a driver whose insurance is blocked (the intended change).

-- --------------------------------------------
-- 1. drivers: new columns
-- --------------------------------------------
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_carrier text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_bi_per_person integer;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_bi_per_accident integer;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_pd_limit integer;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_business_use boolean;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS registration_expiry date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_photo_cargo_url text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cargo_length_in numeric(6,1);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cargo_width_in numeric(6,1);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cargo_height_in numeric(6,1);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cargo_capacity_lbs integer;

-- Sane bounds. Mirrored in apps/web/lib/driver-profile.ts (DIMENSION_BOUNDS,
-- LIMIT_MAX). New columns are NULL on existing rows, so these validate now.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_cargo_length_in_check' AND conrelid = 'public.drivers'::regclass) THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_cargo_length_in_check
      CHECK (cargo_length_in IS NULL OR cargo_length_in BETWEEN 12 AND 480);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_cargo_width_in_check' AND conrelid = 'public.drivers'::regclass) THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_cargo_width_in_check
      CHECK (cargo_width_in IS NULL OR cargo_width_in BETWEEN 12 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_cargo_height_in_check' AND conrelid = 'public.drivers'::regclass) THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_cargo_height_in_check
      CHECK (cargo_height_in IS NULL OR cargo_height_in BETWEEN 6 AND 144);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_cargo_capacity_lbs_check' AND conrelid = 'public.drivers'::regclass) THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_cargo_capacity_lbs_check
      CHECK (cargo_capacity_lbs IS NULL OR cargo_capacity_lbs BETWEEN 25 AND 26000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_insurance_limits_check' AND conrelid = 'public.drivers'::regclass) THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_insurance_limits_check
      CHECK (
        (insurance_bi_per_person IS NULL OR insurance_bi_per_person BETWEEN 0 AND 100000000)
        AND (insurance_bi_per_accident IS NULL OR insurance_bi_per_accident BETWEEN 0 AND 100000000)
        AND (insurance_pd_limit IS NULL OR insurance_pd_limit BETWEEN 0 AND 100000000)
      );
  END IF;
END $$;

-- --------------------------------------------
-- 2. driver_review_items
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  item text NOT NULL,
  photo_path text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_review_items_driver_item_key UNIQUE (driver_id, item)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_review_items_item_check' AND conrelid = 'public.driver_review_items'::regclass) THEN
    ALTER TABLE public.driver_review_items ADD CONSTRAINT driver_review_items_item_check
      CHECK (item IN (
        'hi_vis_vest', 'straps_blankets', 'cooler_temp_kit', 'hand_truck',
        'safety_glasses', 'boots', 'gloves', 'mask',
        'vehicle_front', 'vehicle_back', 'vehicle_side', 'vehicle_cargo',
        'insurance_card', 'registration', 'cargo_dimensions'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_review_items_status_check' AND conrelid = 'public.driver_review_items'::regclass) THEN
    ALTER TABLE public.driver_review_items ADD CONSTRAINT driver_review_items_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_driver_review_items_status ON public.driver_review_items(status);

ALTER TABLE public.driver_review_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.driver_review_items FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.driver_review_items TO authenticated;
GRANT ALL ON public.driver_review_items TO service_role;

-- Driver: own rows only. No DELETE policy for anyone but the service role.
DROP POLICY IF EXISTS "driver_review_items_own_select" ON public.driver_review_items;
CREATE POLICY "driver_review_items_own_select" ON public.driver_review_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_review_items.driver_id AND d.profile_id = auth.uid()));

DROP POLICY IF EXISTS "driver_review_items_own_insert" ON public.driver_review_items;
CREATE POLICY "driver_review_items_own_insert" ON public.driver_review_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_review_items.driver_id AND d.profile_id = auth.uid()));

DROP POLICY IF EXISTS "driver_review_items_own_update" ON public.driver_review_items;
CREATE POLICY "driver_review_items_own_update" ON public.driver_review_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_review_items.driver_id AND d.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_review_items.driver_id AND d.profile_id = auth.uid()));

-- Staff (admin / dispatcher): read and review every row.
DROP POLICY IF EXISTS "driver_review_items_staff_select" ON public.driver_review_items;
CREATE POLICY "driver_review_items_staff_select" ON public.driver_review_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')));

DROP POLICY IF EXISTS "driver_review_items_staff_insert" ON public.driver_review_items;
CREATE POLICY "driver_review_items_staff_insert" ON public.driver_review_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')));

DROP POLICY IF EXISTS "driver_review_items_staff_update" ON public.driver_review_items;
CREATE POLICY "driver_review_items_staff_update" ON public.driver_review_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher')));

-- --------------------------------------------
-- 3. Helpers
-- --------------------------------------------
-- A driver-owned upload path: drivers/<profile_id>/<one safe file segment>.
-- Mirrors isOwnUploadPath in apps/web/lib/driver-profile.ts.
CREATE OR REPLACE FUNCTION public.is_driver_own_upload_path(p_path text, p_profile uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  select p_path is not null
     and p_profile is not null
     and left(p_path, length('drivers/' || p_profile::text || '/')) = 'drivers/' || p_profile::text || '/'
     and substr(p_path, length('drivers/' || p_profile::text || '/') + 1) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
     and position('..' in p_path) = 0;
$function$;

-- The drivers column that holds the file for a document / vehicle item.
CREATE OR REPLACE FUNCTION public.driver_item_file(p_driver public.drivers, p_item text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select case p_item
    when 'insurance_card' then p_driver.insurance_card_url
    when 'registration' then p_driver.registration_url
    when 'vehicle_front' then p_driver.vehicle_photo_front_url
    when 'vehicle_back' then p_driver.vehicle_photo_back_url
    when 'vehicle_side' then p_driver.vehicle_photo_side_url
    when 'vehicle_cargo' then p_driver.vehicle_photo_cargo_url
    else null
  end;
$function$;

-- --------------------------------------------
-- 4. Guard: review rows
-- --------------------------------------------
-- SECURITY INVOKER on purpose so caller_is_staff() sees the real caller and
-- the drivers lookup runs under the caller's RLS.
CREATE OR REPLACE FUNCTION public.guard_driver_review_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_driver public.drivers;
  v_on_file text;
begin
  new.updated_at := now();

  if public.caller_is_staff() then
    if new.status = 'rejected' and nullif(btrim(coalesce(new.reason, '')), '') is null then
      raise exception 'A rejection needs a reason' using errcode = '23514';
    end if;
    if new.status = 'approved' then
      new.reason := null;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (new.driver_id is distinct from old.driver_id or new.item is distinct from old.item) then
    raise exception 'A review item cannot be moved to another driver or item' using errcode = '42501';
  end if;

  select * into v_driver from public.drivers d where d.id = new.driver_id;
  if not found or v_driver.profile_id is distinct from auth.uid() then
    raise exception 'Drivers may only submit their own items' using errcode = '42501';
  end if;

  -- Every driver write is a new submission waiting for dispatch.
  new.status := 'pending';
  new.reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.uploaded_at := now();

  if new.item = 'cargo_dimensions' then
    new.photo_path := null;
    return new;
  end if;

  if new.photo_path is null then
    raise exception 'A photo is required' using errcode = '42501';
  end if;

  -- Own folder, or exactly the file already on the driver record for this item.
  v_on_file := public.driver_item_file(v_driver, new.item);
  if not public.is_driver_own_upload_path(new.photo_path, v_driver.profile_id)
     and new.photo_path is distinct from v_on_file then
    raise exception 'Photo path must be in your own folder' using errcode = '42501';
  end if;

  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_driver_review_item() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_driver_review_item ON public.driver_review_items;
CREATE TRIGGER guard_driver_review_item
  BEFORE INSERT OR UPDATE ON public.driver_review_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_review_item();

-- --------------------------------------------
-- 5. Guard: drivers profile fields (BEFORE)
-- --------------------------------------------
-- Non-staff only:
--   * vehicle identity is fixed after signup;
--   * a new or changed document/photo path must be in the driver's own
--     folder. On INSERT the three legacy folders written by /api/upload
--     (insurance/, registration/, vehicles/) are also accepted so an
--     applicant on a cached older page is not stuck; the file still lands
--     as 'pending' for dispatch to review.
CREATE OR REPLACE FUNCTION public.guard_driver_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_cols text[] := array[
    'insurance_card_url', 'registration_url', 'vehicle_photo_front_url',
    'vehicle_photo_back_url', 'vehicle_photo_side_url', 'vehicle_photo_cargo_url'
  ];
  v_col text;
  v_new text;
  v_old text;
begin
  if public.caller_is_staff() then
    return new;
  end if;

  if tg_op = 'UPDATE' and (
       new.vehicle_type is distinct from old.vehicle_type
       or new.vehicle_make is distinct from old.vehicle_make
       or new.vehicle_model is distinct from old.vehicle_model
       or new.vehicle_year is distinct from old.vehicle_year
       or new.vehicle_plate is distinct from old.vehicle_plate
       or new.vehicle_vin is distinct from old.vehicle_vin) then
    raise exception 'Vehicle type, make, model, year, plate, and VIN are changed by dispatch'
      using errcode = '42501';
  end if;

  foreach v_col in array v_cols loop
    v_new := to_jsonb(new) ->> v_col;
    v_old := case when tg_op = 'UPDATE' then to_jsonb(old) ->> v_col else null end;
    if v_new is not null and v_new is distinct from v_old then
      if not public.is_driver_own_upload_path(v_new, new.profile_id)
         and not (
           tg_op = 'INSERT'
           and v_new ~ '^(insurance|registration|vehicles)/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
         ) then
        raise exception 'Document path for % must be in your own folder', v_col
          using errcode = '42501';
      end if;
    end if;
  end loop;

  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_driver_profile_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_driver_profile_fields ON public.drivers;
CREATE TRIGGER guard_driver_profile_fields
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_profile_fields();

-- --------------------------------------------
-- 6. Queue re-review when a driver changes a reviewed group (AFTER)
-- --------------------------------------------
-- SECURITY INVOKER: the upsert runs as the driver, so guard_driver_review_item
-- forces it to 'pending' and checks ownership. Staff edits are not queued.
CREATE OR REPLACE FUNCTION public.queue_driver_profile_reviews()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_n jsonb := to_jsonb(new);
  v_o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_groups jsonb := jsonb_build_object(
    'insurance_card', jsonb_build_array('insurance_card_url', 'insurance_policy', 'insurance_expiry',
                                        'insurance_carrier', 'insurance_bi_per_person',
                                        'insurance_bi_per_accident', 'insurance_pd_limit',
                                        'insurance_business_use'),
    'registration', jsonb_build_array('registration_url', 'registration_expiry'),
    'vehicle_front', jsonb_build_array('vehicle_photo_front_url'),
    'vehicle_back', jsonb_build_array('vehicle_photo_back_url'),
    'vehicle_side', jsonb_build_array('vehicle_photo_side_url'),
    'vehicle_cargo', jsonb_build_array('vehicle_photo_cargo_url'),
    'cargo_dimensions', jsonb_build_array('cargo_length_in', 'cargo_width_in', 'cargo_height_in',
                                          'cargo_capacity_lbs')
  );
  v_item text;
  v_cols jsonb;
  v_col text;
  v_changed boolean;
  v_file text;
begin
  if public.caller_is_staff() then
    return null;
  end if;

  for v_item, v_cols in select * from jsonb_each(v_groups) loop
    v_changed := false;
    for v_col in select jsonb_array_elements_text(v_cols) loop
      if (v_n -> v_col) is distinct from (v_o -> v_col) then
        v_changed := true;
      end if;
    end loop;
    if not v_changed then
      continue;
    end if;

    if v_item = 'cargo_dimensions' then
      -- Only a complete set of dimensions is submitted for review.
      if new.cargo_length_in is null or new.cargo_width_in is null
         or new.cargo_height_in is null or new.cargo_capacity_lbs is null then
        continue;
      end if;
      v_file := null;
    else
      v_file := public.driver_item_file(new, v_item);
      if v_file is null then
        continue;
      end if;
    end if;

    insert into public.driver_review_items (driver_id, item, photo_path)
    values (new.id, v_item, v_file)
    on conflict (driver_id, item) do update
      set photo_path = excluded.photo_path,
          status = 'pending';
  end loop;

  return null;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.queue_driver_profile_reviews() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS queue_driver_profile_reviews ON public.drivers;
CREATE TRIGGER queue_driver_profile_reviews
  AFTER INSERT OR UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.queue_driver_profile_reviews();

-- --------------------------------------------
-- 7. Offer eligibility (insurance only)
-- --------------------------------------------
-- Returns NULL when the driver may take new work. Reason strings and order
-- are mirrored in offerBlockReason() in apps/web/lib/driver-profile.ts.
-- "Today" is the calendar date in America/Los_Angeles; a policy whose
-- expiry date is today still counts as current for the whole day.
CREATE OR REPLACE FUNCTION public.driver_offer_block_reason(p_driver_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_driver public.drivers;
  v_review public.driver_review_items;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  select * into v_driver from public.drivers where id = p_driver_id;
  if not found then
    return 'Driver not found';
  end if;
  if v_driver.insurance_card_url is null then
    return 'No insurance card on file';
  end if;
  if v_driver.insurance_expiry is null then
    return 'No insurance expiry date on file';
  end if;
  if v_driver.insurance_expiry < v_today then
    return 'Insurance expired on ' || to_char(v_driver.insurance_expiry, 'YYYY-MM-DD');
  end if;

  select * into v_review from public.driver_review_items
   where driver_id = p_driver_id and item = 'insurance_card';
  if not found then
    return 'Insurance card has not been reviewed by dispatch';
  end if;
  if v_review.photo_path is distinct from v_driver.insurance_card_url then
    return 'Insurance card changed and needs dispatch review';
  end if;
  if v_review.status = 'pending' then
    return 'Insurance card is waiting for dispatch review';
  end if;
  if v_review.status = 'rejected' then
    return 'Insurance card was rejected by dispatch';
  end if;
  return null;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.driver_offer_block_reason(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_offer_block_reason(uuid) TO service_role;

-- SECURITY DEFINER so the check reads every table regardless of the caller's
-- RLS; the trigger itself needs no EXECUTE grant.
CREATE OR REPLACE FUNCTION public.guard_new_work_insurance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_driver uuid;
  v_reason text;
begin
  if tg_table_name = 'job_offers' then
    if tg_op = 'UPDATE' and not (new.status = 'accepted' and old.status is distinct from 'accepted') then
      return new;
    end if;
    v_driver := new.driver_id;
  else
    -- deliveries: only when a driver is newly put on the job.
    if new.driver_id is null then
      return new;
    end if;
    if tg_op = 'UPDATE' and new.driver_id is not distinct from old.driver_id then
      return new;
    end if;
    v_driver := new.driver_id;
  end if;

  v_reason := public.driver_offer_block_reason(v_driver);
  if v_reason is not null then
    raise exception 'This driver cannot take new jobs: %', v_reason
      using errcode = '42501',
            hint = 'A current insurance card must be uploaded and approved by dispatch.';
  end if;
  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_new_work_insurance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_new_work_insurance ON public.job_offers;
CREATE TRIGGER guard_new_work_insurance
  BEFORE INSERT OR UPDATE OF status ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.guard_new_work_insurance();

DROP TRIGGER IF EXISTS guard_new_work_insurance ON public.deliveries;
CREATE TRIGGER guard_new_work_insurance
  BEFORE INSERT OR UPDATE OF driver_id ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_new_work_insurance();

-- --------------------------------------------
-- Verification (run by hand in the SQL editor; changes nothing)
-- --------------------------------------------
-- Replace <DRIVER_PROFILE_UUID> with a driver's profile_id, <DRIVER_ID> with
-- that driver's drivers.id, <STAFF_UUID> with an admin/dispatcher profile id,
-- and <BOOKED_DELIVERY_UUID> with a booked, unassigned delivery.
-- Every block ends in ROLLBACK.
--
-- -- 1. A driver cannot approve their own item.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DRIVER_PROFILE_UUID>","role":"authenticated"}';
--   INSERT INTO public.driver_review_items (driver_id, item, photo_path, status)
--   VALUES ('<DRIVER_ID>', 'gloves', 'drivers/<DRIVER_PROFILE_UUID>/gloves-1.jpg', 'approved')
--   RETURNING status, reviewed_by;
--   -- Expect: pending | NULL
-- ROLLBACK;
--
-- -- 2. A driver cannot point a photo at someone else's folder.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DRIVER_PROFILE_UUID>","role":"authenticated"}';
--   INSERT INTO public.driver_review_items (driver_id, item, photo_path)
--   VALUES ('<DRIVER_ID>', 'gloves', 'drivers/00000000-0000-0000-0000-000000000000/x.jpg');
--   -- Expect: ERROR 42501 Photo path must be in your own folder
-- ROLLBACK;
--
-- -- 3. Staff can approve; a rejection without a reason is refused.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<STAFF_UUID>","role":"authenticated"}';
--   INSERT INTO public.driver_review_items (driver_id, item, photo_path, status, reason)
--   VALUES ('<DRIVER_ID>', 'gloves', 'drivers/x/gloves.jpg', 'rejected', '');
--   -- Expect: ERROR 23514 A rejection needs a reason
-- ROLLBACK;
--
-- -- 4. Who is blocked from new work right now (no PII):
-- SELECT id, status, public.driver_offer_block_reason(id) AS block_reason FROM public.drivers;
--
-- -- 5. Offering a job to a blocked driver is refused, even for the service role.
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   INSERT INTO public.job_offers (delivery_id, driver_id, status, expires_at)
--   VALUES ('<BOOKED_DELIVERY_UUID>', '<DRIVER_ID>', 'pending', now() + interval '15 minutes');
--   -- Expect (if the driver is blocked): ERROR 42501 This driver cannot take new jobs: ...
-- ROLLBACK;
--
-- Rollback of this migration (manual, only if needed; drops P-366 objects):
--   DROP TRIGGER IF EXISTS guard_new_work_insurance ON public.job_offers;
--   DROP TRIGGER IF EXISTS guard_new_work_insurance ON public.deliveries;
--   DROP TRIGGER IF EXISTS queue_driver_profile_reviews ON public.drivers;
--   DROP TRIGGER IF EXISTS guard_driver_profile_fields ON public.drivers;
--   The table and columns can stay; they are unused by the older code.
