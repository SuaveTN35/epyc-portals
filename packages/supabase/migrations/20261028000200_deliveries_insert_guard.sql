-- ============================================
-- DELIVERIES INSERT GUARD (P-354, 2026-10-28)
-- ============================================
-- The live RLS policy "Customers can create deliveries" only checks
-- customer_id = auth.uid(). It cannot stop a customer from inserting a row
-- that is already assigned to a driver, already 'delivered', or that carries
-- a driver_payout of their choosing. This BEFORE INSERT trigger normalizes
-- every non-staff insert:
--
--   * customer_id must equal auth.uid()         (else errcode 42501)
--   * driver_id, assigned_at                     -> NULL
--   * status outside quote_requested/quoted/booked (or NULL) -> 'booked'
--   * booked_at                                  -> now() when status is
--                                                   'booked', else NULL
--   * driver_payout                              -> NULL (dispatch sets it)
--   * actual_pickup_time, actual_delivery_time   -> NULL
--   * source                                     -> 'direct'
--   * source_reference                           -> NULL
--   * tracking_number                            -> generated when blank
--
-- Staff (admin/dispatcher) and the service role pass through unchanged:
-- caller_is_staff() is true for both.
--
-- ADDITIVE ONLY: one new function and one new trigger. Safe to re-run.
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff())
-- and 20261028000000_phase2_jobs.sql (deliveries.source, source_reference).
--
-- SECURITY INVOKER on purpose so caller_is_staff() and auth.uid() see the
-- real caller.

CREATE OR REPLACE FUNCTION public.guard_delivery_customer_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if public.caller_is_staff() then
    return new;
  end if;

  if auth.uid() is null or new.customer_id is distinct from auth.uid() then
    raise exception 'Deliveries can only be created for your own account'
      using errcode = '42501';
  end if;

  new.driver_id := null;
  new.assigned_at := null;
  new.driver_payout := null;
  new.actual_pickup_time := null;
  new.actual_delivery_time := null;
  new.source := 'direct';
  new.source_reference := null;

  if new.status is null or new.status not in ('quote_requested', 'quoted', 'booked') then
    new.status := 'booked';
  end if;

  if new.status = 'booked' then
    new.booked_at := now();
  else
    new.booked_at := null;
  end if;

  if nullif(btrim(coalesce(new.tracking_number, '')), '') is null then
    new.tracking_number := 'EPYC' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  end if;

  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_delivery_customer_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_delivery_customer_insert ON public.deliveries;
CREATE TRIGGER guard_delivery_customer_insert
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_customer_insert();

-- --------------------------------------------
-- Verification (run by hand in the SQL editor; changes nothing)
-- --------------------------------------------
-- Replace <CUSTOMER_UUID> with a profiles.id whose role is 'customer' and
-- <OTHER_UUID> with any other profiles.id. Every block ends in ROLLBACK.
--
-- -- 1. A customer who sends driver fields and a 'delivered' status gets a
-- --    clean booked row back.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}';
--   INSERT INTO public.deliveries (
--     tracking_number, customer_id, status, driver_payout, assigned_at,
--     actual_delivery_time, source, booked_at,
--     pickup_address, pickup_city, pickup_state, pickup_zip,
--     delivery_address, delivery_city, delivery_state, delivery_zip
--   ) VALUES (
--     'EPYCGUARDTEST1', '<CUSTOMER_UUID>', 'delivered', 999, now(),
--     now(), 'curri', '2020-01-01',
--     '1 Test St', 'Los Angeles', 'CA', '90001',
--     '2 Test St', 'Los Angeles', 'CA', '90002'
--   )
--   RETURNING status, driver_id, driver_payout, assigned_at,
--             actual_delivery_time, source, booked_at;
--   -- Expect: booked | NULL | NULL | NULL | NULL | direct | now()
-- ROLLBACK;
--
-- -- 2. A customer inserting for someone else is refused (42501).
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}';
--   INSERT INTO public.deliveries (
--     tracking_number, customer_id,
--     pickup_address, pickup_city, pickup_state, pickup_zip,
--     delivery_address, delivery_city, delivery_state, delivery_zip
--   ) VALUES (
--     'EPYCGUARDTEST2', '<OTHER_UUID>',
--     '1 Test St', 'Los Angeles', 'CA', '90001',
--     '2 Test St', 'Los Angeles', 'CA', '90002'
--   );
--   -- Expect: ERROR 42501 (RLS or this trigger, whichever fires first)
-- ROLLBACK;
--
-- -- 3. The service role passes through untouched.
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   INSERT INTO public.deliveries (
--     tracking_number, customer_id, status, driver_payout, source,
--     pickup_address, pickup_city, pickup_state, pickup_zip,
--     delivery_address, delivery_city, delivery_state, delivery_zip
--   ) VALUES (
--     'EPYCGUARDTEST3', '<OTHER_UUID>', 'quoted', 42, 'curri',
--     '1 Test St', 'Los Angeles', 'CA', '90001',
--     '2 Test St', 'Los Angeles', 'CA', '90002'
--   )
--   RETURNING status, driver_payout, source;
--   -- Expect: quoted | 42 | curri
-- ROLLBACK;
