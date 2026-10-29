-- ============================================
-- GRACE FOR THE REQUIRED-ITEMS BLOCK (P-366, 2026-10-28)
-- ============================================
-- Commander ruling 2026-10-28: drivers already ACTIVE when the required-items
-- block (20261028000600) ships get 14 days before missing or rejected
-- vehicle photos, cargo size, or registration block new offers. During the
-- grace the driver sees an amber "Upload by <date>" warning and dispatch a
-- badge; nothing blocks. Insurance has NO grace (unchanged). Drivers approved
-- after this ships get no grace.
--
-- drivers.items_required_from date: the Pacific date from which the items
-- rule applies. Backfilled once, when the column is added, to (Pacific today)
-- + 14 for active drivers; NULL means no grace. Same style and same start rule as
-- drivers.selfie_required_from in 20261028000700 (both: Pacific date of
-- apply + 14, NULL = no grace, drivers cannot set or change it).
--
-- Separate from 0600 (not folded in) so 0600 stays the plain rule and this
-- file is the time-boxed exception; the two are applied together in the same
-- deploy, 0600 then 0650.
--
-- driver_offer_block_reason(): the 0600 body, with the required-items loop
-- skipped while items_required_from > today. guard_driver_profile_fields():
-- the 0500 body plus the items_required_from guard.
--
-- ADDITIVE / SAFE TO RE-RUN: the column and its one-time backfill are added
-- together only when the column does not exist yet; CREATE OR REPLACE for the
-- functions. A re-run changes no driver's date.
-- Rollback: re-run 20261028000600 (rule without grace) and the
-- guard_driver_profile_fields section of 20261028000500.

-- One time only (AEQUALIS QA): the grace backfill runs in the same step that
-- adds the column. A re-run finds the column and does nothing, so a driver
-- approved after the first apply (NULL = no grace) never gets a grace date.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'items_required_from'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN items_required_from date;
    UPDATE public.drivers
       SET items_required_from = (now() at time zone 'America/Los_Angeles')::date + 14
     WHERE status = 'active';
  END IF;
END $$;

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

  -- Grace dates are set by the system and dispatch only (0650).
  if tg_op = 'INSERT' then
    new.items_required_from := null;
  elsif new.items_required_from is distinct from old.items_required_from then
    raise exception 'The required items date is set by dispatch' using errcode = '42501';
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
      if not public.is_driver_own_upload_path(v_new, new.profile_id) then
        raise exception 'Document path for % must be in your own folder', v_col
          using errcode = '42501';
      end if;
    end if;
  end loop;

  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_driver_profile_fields() FROM PUBLIC, anon, authenticated;

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
  v_req record;
  v_file text;
  v_missing text[] := '{}';
  v_rejected text[] := '{}';
  v_has_row boolean;
begin
  select * into v_driver from public.drivers where id = p_driver_id;
  if not found then
    return 'Driver not found';
  end if;

  -- Insurance (unchanged from 20261028000500).
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

  -- Required vehicle and document items (Commander ruling 2026-10-28),
  -- skipped while the driver is inside the grace window (0650).
  if v_driver.items_required_from is null or v_driver.items_required_from <= v_today then
    for v_req in
      select t.item, t.label from (values
        (1, 'vehicle_front', 'Vehicle - front'),
        (2, 'vehicle_back', 'Vehicle - back'),
        (3, 'vehicle_side', 'Vehicle - side'),
        (4, 'vehicle_cargo', 'Cargo area'),
        (5, 'cargo_dimensions', 'Cargo size and capacity'),
        (6, 'registration', 'Vehicle registration')
      ) as t(ord, item, label)
      order by t.ord
    loop
      select * into v_review from public.driver_review_items
       where driver_id = p_driver_id and item = v_req.item;
      v_has_row := found;

      if v_req.item = 'cargo_dimensions' then
        if v_driver.cargo_length_in is null or v_driver.cargo_width_in is null
           or v_driver.cargo_height_in is null or v_driver.cargo_capacity_lbs is null then
          v_missing := v_missing || v_req.label;
        elsif v_has_row and v_review.status = 'rejected' then
          v_rejected := v_rejected || v_req.label;
        end if;
      else
        v_file := public.driver_item_file(v_driver, v_req.item);
        if v_file is null then
          v_missing := v_missing || v_req.label;
        elsif v_has_row and v_review.status = 'rejected' and v_review.photo_path = v_file then
          v_rejected := v_rejected || v_req.label;
        end if;
      end if;
    end loop;

    if cardinality(v_missing) > 0 then
      return 'Missing required items: ' || array_to_string(v_missing, ', ');
    end if;
    if cardinality(v_rejected) > 0 then
      return 'Rejected items need a new upload: ' || array_to_string(v_rejected, ', ');
    end if;
  end if;
  return null;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.driver_offer_block_reason(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_offer_block_reason(uuid) TO service_role;

-- --------------------------------------------
-- Verification (run by hand; changes nothing)
-- --------------------------------------------
-- SELECT id, status, items_required_from, public.driver_offer_block_reason(id) AS block_reason FROM public.drivers;
