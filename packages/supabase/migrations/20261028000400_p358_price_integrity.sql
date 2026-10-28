-- ============================================
-- BOOKING PRICE INTEGRITY (P-358, 2026-10-28)
-- ============================================
-- Before this migration a customer created a delivery by inserting the row
-- straight from the browser, price included, and the payment intent charged
-- deliveries.total_price. Anyone calling the REST API directly could set
-- their own price and pay it. The insert guard from 20261028000200
-- normalized driver fields but left pricing, company_id and tip_amount alone.
--
-- Booking now goes through POST /api/client/deliveries, which recomputes the
-- distance and the quote on the server and inserts with the service role.
-- Every insert path into deliveries in the codebase was checked
-- (apps/web, apps/dispatch, apps/client-portal, apps/driver-portal, DB
-- functions):
--   * apps/web /api/client/deliveries        service role   (new, P-358)
--   * apps/web /api/broker/deliveries        service role   (prices server-side)
--   * apps/web dispatch "new delivery" page  admin/dispatcher session (staff)
--   * apps/web client "new delivery" page    no longer inserts (uses the route)
--   * apps/client-portal new delivery page   legacy app, direct customer
--                                            insert; refused from here on
--   * no database function inserts into deliveries
-- So no legitimate non-staff insert path remains, and this migration:
--
--   1. guard_delivery_customer_insert: non-staff callers (anon, customers,
--      drivers) can no longer insert into deliveries at all. errcode 42501.
--      Because the row is refused outright, no customer-chosen price,
--      company_id, or tip_amount can land. Staff (admin/dispatcher) and the
--      service role pass through unchanged (caller_is_staff() is true).
--
--   2. guard_proof_photo_path (new): for non-staff inserts into
--      proof_of_delivery (drivers insert their own rows directly), a
--      non-null photo_url must be "<delivery_id>/<file>" with one safe file
--      segment: [A-Za-z0-9][A-Za-z0-9._-]{0,199}, no "..". Mirrors
--      isProofPathForDelivery in apps/web/lib/proof-flow.ts. Fires on INSERT
--      and on UPDATE OF photo_url, delivery_id only, so existing rows are
--      never re-checked (live table had 0 rows on 2026-10-27).
--
-- ADDITIVE / SAFE TO RE-RUN: CREATE OR REPLACE functions, DROP TRIGGER IF
-- EXISTS + CREATE TRIGGER. No table, column, policy, or data changes.
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff())
-- and 20261028000200_deliveries_insert_guard.sql (the trigger it replaces).
--
-- To undo part 1, re-run 20261028000200_deliveries_insert_guard.sql (it
-- restores the normalizing version). The booking route keeps working either
-- way because it uses the service role.
--
-- SECURITY INVOKER on purpose so caller_is_staff() sees the real caller.

-- --------------------------------------------
-- 1. Deliveries: staff and service role only
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_delivery_customer_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if public.caller_is_staff() then
    return new;
  end if;

  raise exception 'Deliveries are booked through the booking service, not inserted directly'
    using errcode = '42501',
          hint = 'Use POST /api/client/deliveries. The price is computed by the server.';
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_delivery_customer_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_delivery_customer_insert ON public.deliveries;
CREATE TRIGGER guard_delivery_customer_insert
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_customer_insert();

-- --------------------------------------------
-- 2. Proof photos: path must be under the delivery's own folder
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_proof_photo_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  prefix text;
  file text;
begin
  if public.caller_is_staff() then
    return new;
  end if;

  if new.photo_url is null then
    return new;
  end if;

  prefix := new.delivery_id::text || '/';
  if left(new.photo_url, length(prefix)) <> prefix then
    raise exception 'Proof photo path must start with the delivery id folder'
      using errcode = '42501';
  end if;

  file := substr(new.photo_url, length(prefix) + 1);
  if file !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$' or position('..' in file) > 0 then
    raise exception 'Proof photo path has an invalid file name'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_proof_photo_path() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_proof_photo_path ON public.proof_of_delivery;
CREATE TRIGGER guard_proof_photo_path
  BEFORE INSERT OR UPDATE OF photo_url, delivery_id ON public.proof_of_delivery
  FOR EACH ROW EXECUTE FUNCTION public.guard_proof_photo_path();

-- --------------------------------------------
-- Verification (run by hand in the SQL editor; changes nothing)
-- --------------------------------------------
-- Replace <CUSTOMER_UUID> with a profiles.id whose role is 'customer',
-- <DRIVER_PROFILE_UUID> with the profile_id of a driver, and
-- <ASSIGNED_DELIVERY_UUID> with a delivery assigned to that driver.
-- Every block ends in ROLLBACK.
--
-- -- 1. A customer inserting a delivery directly, at any price, is refused.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}';
--   INSERT INTO public.deliveries (
--     tracking_number, customer_id, status, total_price, company_id, tip_amount,
--     pickup_address, pickup_city, pickup_state, pickup_zip,
--     delivery_address, delivery_city, delivery_state, delivery_zip
--   ) VALUES (
--     'EPYCP358TEST1', '<CUSTOMER_UUID>', 'booked', 1.00, gen_random_uuid(), 500,
--     '1 Test St', 'Los Angeles', 'CA', '90001',
--     '2 Test St', 'Los Angeles', 'CA', '90002'
--   );
--   -- Expect: ERROR 42501 Deliveries are booked through the booking service ...
-- ROLLBACK;
--
-- -- 2. The service role (the booking route) still inserts.
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   INSERT INTO public.deliveries (
--     tracking_number, customer_id, status, total_price,
--     pickup_address, pickup_city, pickup_state, pickup_zip,
--     delivery_address, delivery_city, delivery_state, delivery_zip
--   ) VALUES (
--     'EPYCP358TEST2', '<CUSTOMER_UUID>', 'booked', 43.45,
--     '1 Test St', 'Los Angeles', 'CA', '90001',
--     '2 Test St', 'Los Angeles', 'CA', '90002'
--   )
--   RETURNING status, total_price, company_id, tip_amount;
--   -- Expect: booked | 43.45 | NULL | 0
-- ROLLBACK;
--
-- -- 3. A driver proof row pointing at another folder is refused; a correct
-- --    path is accepted.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DRIVER_PROFILE_UUID>","role":"authenticated"}';
--   INSERT INTO public.proof_of_delivery (delivery_id, type, stage, photo_kind, photo_url)
--   VALUES ('<ASSIGNED_DELIVERY_UUID>', 'photo', 'delivery', 'placement',
--           '00000000-0000-0000-0000-000000000000/x.jpg');
--   -- Expect: ERROR 42501 Proof photo path must start with the delivery id folder
-- ROLLBACK;
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DRIVER_PROFILE_UUID>","role":"authenticated"}';
--   INSERT INTO public.proof_of_delivery (delivery_id, type, stage, photo_kind, photo_url)
--   VALUES ('<ASSIGNED_DELIVERY_UUID>', 'photo', 'delivery', 'placement',
--           '<ASSIGNED_DELIVERY_UUID>/delivery-placement-1761600000000-ab12.jpg')
--   RETURNING photo_url;
--   -- Expect: the row comes back
-- ROLLBACK;
