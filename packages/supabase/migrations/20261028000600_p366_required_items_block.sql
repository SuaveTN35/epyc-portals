-- ============================================
-- REQUIRED ITEMS BLOCK NEW WORK (P-366, 2026-10-28)
-- ============================================
-- Commander ruling 2026-10-28 ("Until uploaded"): an approved driver gets no
-- new work until every REQUIRED vehicle and document item is uploaded. This
-- replaces the 2026-10-27 rule that only insurance blocks.
--
-- driver_offer_block_reason(driver_id) keeps every insurance check from
-- 20261028000500 unchanged (same strings, same order, checked first), then:
--   1. Missing required items, in config order (lib/driver-profile-items.ts):
--        vehicle_front, vehicle_back, vehicle_side, vehicle_cargo,
--        cargo_dimensions, registration
--      A file item is missing when its drivers column is null; cargo
--      dimensions are missing unless all four cargo columns are set.
--      -> 'Missing required items: <labels joined by ", ">'
--   2. Rejected required items: a review row with status 'rejected' (for a
--      file item, only while it is still the file on the driver record; a
--      re-upload resets the row to 'pending').
--      -> 'Rejected items need a new upload: <labels>'
-- Pending or unreviewed items do NOT block (the driver has done their part).
-- Registration expiry does NOT block. Gear never blocks (TRIBUNAL R12).
--
-- The item list and labels are mirrored in NEW_WORK_REQUIRED_ITEM_IDS and
-- requiredItemsBlockReason() in apps/web/lib/driver-profile.ts; a unit test
-- pins the list. Flipping `required` on a vehicle/document item there needs
-- this list changed too.
--
-- guard_new_work_insurance (job_offers INSERT / accept, deliveries driver_id)
-- calls this function, so it enforces the new rule with no change. Jobs
-- already assigned are never touched.
--
-- ADDITIVE / SAFE TO RE-RUN: CREATE OR REPLACE of one function, same
-- signature, same grants. No table, column, policy, or data changes.
-- Rollback: re-run the driver_offer_block_reason section of
-- 20261028000500_p366_driver_profile.sql.

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

  -- Required vehicle and document items (Commander ruling 2026-10-28).
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
  return null;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.driver_offer_block_reason(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_offer_block_reason(uuid) TO service_role;

-- --------------------------------------------
-- Verification (run by hand; changes nothing)
-- --------------------------------------------
-- SELECT id, status, public.driver_offer_block_reason(id) AS block_reason FROM public.drivers;
