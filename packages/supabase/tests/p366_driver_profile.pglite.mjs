// PGlite test for 20261028000500_p366_driver_profile.sql (P-366).
// Not part of the vitest suite (PGlite is not a repo dependency). To run:
//   mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite@0.3
//   cp <repo>/packages/supabase/tests/p366_driver_profile.pglite.mjs .
//   node p366_driver_profile.pglite.mjs <repo-root>
// Builds a minimal Supabase-like scaffold (roles, auth.uid(), live drivers
// policies, caller_is_staff()), applies the migration twice, and checks:
// driver cannot approve own items, staff can; path rules; vehicle identity
// lock; re-review queueing; the insurance block on offers / accept / assign;
// gear declared with optional photo (R12); ID badge photo only after
// approval (R1); deliveries.required_equipment; privileges (QA N3); the
// interaction with the live Phase 0 / Phase 1 drivers guard (AEQUALIS QA
// reproduction, folded in 2026-10-28); 20261028000600 (required items
// block new work, Commander ruling 2026-10-28); and 20261028000650 (14-day
// grace for that block for drivers already active).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const mig = (f) => readFileSync(join(root, 'packages/supabase/migrations', f), 'utf8');

const db = new PGlite();
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra); }
};

const ADMIN = '22222222-2222-2222-2222-222222222222';
const P1 = '33333333-3333-3333-3333-333333333333'; // driver 1 profile
const D1 = '44444444-4444-4444-4444-444444444444';
const P2 = '55555555-5555-5555-5555-555555555555'; // driver 2 profile
const D2 = '66666666-6666-6666-6666-666666666666';
const CUST = '11111111-1111-1111-1111-111111111111';
const DEL = '77777777-7777-7777-7777-777777777777';
const DEL2 = '88888888-8888-8888-8888-888888888888';

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create table public.profiles (id uuid primary key, role varchar default 'customer');
  create table public.drivers (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null,
    status text not null default 'pending',
    vehicle_type text, vehicle_make text, vehicle_model text, vehicle_year int,
    vehicle_plate text, vehicle_vin text,
    insurance_policy text, insurance_expiry date, insurance_card_url text,
    registration_url text,
    vehicle_photo_front_url text, vehicle_photo_back_url text, vehicle_photo_side_url text,
    is_online boolean default false,
    background_check_status text default 'pending', background_check_date date,
    hipaa_certified boolean default false, hipaa_cert_expiry date, rating numeric(3,2) default 5.00,
    total_deliveries int default 0, loyalty_tier text default 'bronze', current_delivery_id uuid,
    updated_at timestamptz default now()
  );
  create table public.deliveries (
    id uuid primary key, customer_id uuid, driver_id uuid references public.drivers(id), status text
  );
  create table public.job_offers (
    id uuid primary key default gen_random_uuid(),
    delivery_id uuid not null references public.deliveries(id),
    driver_id uuid not null references public.drivers(id),
    status text default 'pending', expires_at timestamptz not null
  );
  alter table public.drivers enable row level security;
  alter table public.deliveries enable row level security;
  alter table public.job_offers enable row level security;
  -- Live drivers policies (2026-10-27).
  create policy "Drivers can view own driver record" on public.drivers for select using (profile_id = auth.uid());
  create policy "Drivers can update own driver record" on public.drivers for update using (profile_id = auth.uid());
  create policy "Drivers can insert own driver record" on public.drivers for insert with check (profile_id = auth.uid());
  create policy "Dispatchers can view all drivers" on public.drivers for select using
    (exists (select 1 from profiles where id = auth.uid() and role in ('admin','dispatcher')));
  create policy "Dispatchers can update all drivers" on public.drivers for update using
    (exists (select 1 from profiles where id = auth.uid() and role in ('admin','dispatcher')));
  create policy del_all on public.deliveries for all using (true) with check (true);
  create policy jo_staff on public.job_offers for all to authenticated using
    (exists (select 1 from profiles where id = auth.uid() and role in ('admin','dispatcher')))
    with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin','dispatcher')));
  grant select on public.profiles to anon, authenticated, service_role;
  grant select, insert, update on public.drivers, public.deliveries, public.job_offers to authenticated, service_role;

  create or replace function public.caller_is_staff() returns boolean language plpgsql stable
  set search_path to 'public' as $f$
  begin
    if current_user not in ('authenticated', 'anon') then return true; end if;
    return exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','dispatcher'));
  end; $f$;
  grant execute on function public.caller_is_staff() to anon, authenticated, service_role;


  create or replace function public.guard_driver_protected_fields() returns trigger language plpgsql
  set search_path to 'public' as $f$
  begin
    if public.caller_is_staff() then return new; end if;
    if tg_op = 'INSERT' then
      new.background_check_status := 'pending'; new.background_check_date := null;
      new.hipaa_certified := false; new.hipaa_cert_expiry := null; new.rating := 5.00;
      new.total_deliveries := 0; new.loyalty_tier := 'bronze'; new.status := 'pending';
      new.current_delivery_id := null;
      return new;
    end if;
    if new.background_check_status is distinct from old.background_check_status
       or new.background_check_date is distinct from old.background_check_date
       or new.hipaa_certified is distinct from old.hipaa_certified
       or new.hipaa_cert_expiry is distinct from old.hipaa_cert_expiry
       or new.rating is distinct from old.rating
       or new.total_deliveries is distinct from old.total_deliveries
       or new.loyalty_tier is distinct from old.loyalty_tier
       or new.profile_id is distinct from old.profile_id
       or new.status is distinct from old.status then
      raise exception 'Approval fields are set by dispatch only' using errcode = '42501';
    end if;
    if new.current_delivery_id is distinct from old.current_delivery_id and new.current_delivery_id is not null
       and not exists (select 1 from public.deliveries where id = new.current_delivery_id and driver_id = new.id) then
      raise exception 'not your delivery' using errcode = '42501';
    end if;
    return new;
  end; $f$;
  create trigger guard_driver_protected_fields before insert or update on public.drivers
    for each row execute function public.guard_driver_protected_fields();
  create or replace function public.update_updated_at_column() returns trigger language plpgsql as $f$
  begin new.updated_at := now(); return new; end; $f$;
  create trigger update_drivers_updated_at before update on public.drivers
    for each row execute function public.update_updated_at_column();

  insert into profiles values ('${ADMIN}','admin'), ('${P1}','driver'), ('${P2}','driver'), ('${CUST}','customer');
  -- D1: legacy driver, insurance card in the old folder, current expiry, no review row.
  insert into drivers (id, profile_id, status, vehicle_type, vehicle_make, vehicle_plate,
                       insurance_policy, insurance_expiry, insurance_card_url)
  values ('${D1}', '${P1}', 'active', 'car', 'Toyota', 'ABC123', 'POL1',
          (now() at time zone 'America/Los_Angeles')::date + 60, 'insurance/legacy-1.jpg');
  -- D2: legacy driver with EXPIRED insurance.
  insert into drivers (id, profile_id, status, vehicle_type, insurance_expiry, insurance_card_url)
  values ('${D2}', '${P2}', 'active', 'van',
          (now() at time zone 'America/Los_Angeles')::date - 1, 'insurance/legacy-2.jpg');
  insert into deliveries values ('${DEL}', '${CUST}', null, 'booked'), ('${DEL2}', '${CUST}', null, 'booked');
`);

await db.exec(mig('20261028000500_p366_driver_profile.sql'));
await db.exec(mig('20261028000500_p366_driver_profile.sql'));
ok('migration applies twice without error', true);

const as = async (role, sub, sql) => {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    if (sub) await db.exec(`set local request.jwt.claims = '{"sub":"${sub}","role":"authenticated"}'`);
    const r = await db.query(sql);
    await db.exec('rollback');
    return { rows: r.rows };
  } catch (e) {
    await db.exec('rollback');
    return { error: e };
  }
};
// Same, but keeps the change.
const commitAs = async (role, sub, sql) => {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    if (sub) await db.exec(`set local request.jwt.claims = '{"sub":"${sub}","role":"authenticated"}'`);
    const r = await db.query(sql);
    await db.exec('commit');
    return { rows: r.rows };
  } catch (e) {
    await db.exec('rollback');
    return { error: e };
  }
};
const reason = async (id) => (await db.query(`select public.driver_offer_block_reason('${id}') r`)).rows[0].r;

// ---- Review rows: driver vs staff ----
let r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path, status, reviewed_by, reviewed_at, reason)
  values ('${D1}', 'gloves', 'drivers/${P1}/gloves-1.jpg', 'approved', '${P1}', now(), 'x') returning status, reviewed_by, reviewed_at, reason`);
ok('driver insert forced to pending, reviewer cleared',
  r.rows && r.rows[0].status === 'pending' && r.rows[0].reviewed_by === null && r.rows[0].reviewed_at === null && r.rows[0].reason === null,
  JSON.stringify(r.rows || r.error?.message));

await commitAs('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D1}', 'gloves', 'drivers/${P1}/gloves-1.jpg')`);
r = await as('authenticated', P1, `update driver_review_items set status = 'approved' where driver_id = '${D1}' and item = 'gloves' returning status`);
ok('driver cannot approve own item (update forced back to pending)', r.rows && r.rows[0].status === 'pending', JSON.stringify(r.rows || r.error?.message));

r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D2}', 'boots', 'drivers/${P1}/boots.jpg') returning id`);
ok('driver cannot insert an item for another driver', !!r.error, JSON.stringify(r.rows));

r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D1}', 'boots', 'drivers/${P2}/boots.jpg') returning id`);
ok('driver photo in another driver folder refused', r.error && r.error.code === '42501', r.error?.message);
for (const bad of [`drivers/${P1}/../x.jpg`, `drivers/${P1}/sub/x.jpg`, `insurance/legacy-2.jpg`, `https://evil.example/x.jpg`]) {
  r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D1}', 'boots', '${bad}') returning id`);
  ok(`driver bad photo path refused: ${bad}`, r.error && r.error.code === '42501', r.error?.message || 'inserted');
}
r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D1}', 'vehicle_front', null) returning id`);
ok('driver vehicle photo item without photo refused', !!r.error);

r = await as('authenticated', P1, `select count(*)::int n from driver_review_items where driver_id = '${D2}'`);
ok('driver cannot read another driver rows', r.rows && r.rows[0].n === 0);

r = await as('authenticated', P1, `update driver_review_items set driver_id = '${D2}' where driver_id = '${D1}' and item = 'gloves' returning id`);
ok('driver cannot move an item to another driver', !!r.error, JSON.stringify(r.rows));

r = await as('authenticated', ADMIN, `update driver_review_items set status = 'approved', reviewed_by = '${ADMIN}', reviewed_at = now()
  where driver_id = '${D1}' and item = 'gloves' returning status, reviewed_by`);
ok('staff can approve', r.rows && r.rows[0].status === 'approved' && r.rows[0].reviewed_by === ADMIN, r.error?.message);

r = await as('authenticated', ADMIN, `update driver_review_items set status = 'rejected', reason = '  ' where driver_id = '${D1}' and item = 'gloves' returning status`);
ok('staff rejection without a reason refused', r.error && r.error.code === '23514', r.error?.message);
r = await as('authenticated', ADMIN, `update driver_review_items set status = 'rejected', reason = 'Blurry' where driver_id = '${D1}' and item = 'gloves' returning status, reason`);
ok('staff rejection with reason allowed', r.rows && r.rows[0].status === 'rejected' && r.rows[0].reason === 'Blurry', r.error?.message);

r = await as('authenticated', P1, `delete from driver_review_items where driver_id = '${D1}' returning id`);
ok('driver cannot delete review rows', !!r.error || (r.rows && r.rows.length === 0));

r = await as('anon', null, `select count(*) from driver_review_items`);
ok('anon cannot read review rows', !!r.error);

// ---- Drivers profile fields ----
r = await as('authenticated', P1, `update drivers set vehicle_plate = 'NEW1' where id = '${D1}' returning id`);
ok('driver cannot change plate', r.error && r.error.code === '42501', r.error?.message);
r = await as('authenticated', P1, `update drivers set vehicle_type = 'box_truck' where id = '${D1}' returning id`);
ok('driver cannot change vehicle type', r.error && r.error.code === '42501', r.error?.message);
r = await as('authenticated', ADMIN, `update drivers set vehicle_plate = 'NEW1' where id = '${D1}' returning id`);
ok('staff can change plate', r.rows && r.rows.length === 1, r.error?.message);

r = await as('authenticated', P1, `update drivers set insurance_card_url = 'insurance/someone-else.jpg' where id = '${D1}' returning id`);
ok('driver cannot repoint insurance card to legacy folder on update', r.error && r.error.code === '42501', r.error?.message);
r = await as('authenticated', P1, `update drivers set registration_url = 'drivers/${P2}/reg.jpg' where id = '${D1}' returning id`);
ok('driver cannot repoint registration to another folder', r.error && r.error.code === '42501', r.error?.message);
r = await as('authenticated', P1, `update drivers set cargo_length_in = 5000 where id = '${D1}' returning id`);
ok('cargo length bound enforced', r.error && r.error.code === '23514', r.error?.message);
r = await as('authenticated', P1, `update drivers set is_online = true where id = '${D1}' returning id`);
ok('driver unrelated update still works', r.rows && r.rows.length === 1, r.error?.message);

// ---- Insurance block rule ----
ok('legacy unreviewed card is blocked', (await reason(D1)) === 'Insurance card has not been reviewed by dispatch', await reason(D1));
ok('expired insurance is blocked', /^Insurance expired on \d{4}-\d{2}-\d{2}$/.test(await reason(D2) || ''), await reason(D2));

r = await as('authenticated', ADMIN, `insert into job_offers (delivery_id, driver_id, expires_at) values ('${DEL}', '${D1}', now() + interval '15 minutes') returning id`);
ok('dispatcher offer to unreviewed driver refused', r.error && r.error.code === '42501' && /cannot take new jobs/.test(r.error.message), r.error?.message);
r = await as('service_role', null, `insert into job_offers (delivery_id, driver_id, expires_at) values ('${DEL}', '${D2}', now() + interval '15 minutes') returning id`);
ok('service-role offer to expired driver refused', r.error && r.error.code === '42501', r.error?.message);
r = await as('authenticated', ADMIN, `update deliveries set driver_id = '${D2}', status = 'assigned' where id = '${DEL}' returning id`);
ok('dispatcher direct assign of expired driver refused', r.error && r.error.code === '42501', r.error?.message);

// Staff approves D1's legacy card (photo_path = card on file) -> eligible.
await commitAs('service_role', null, `insert into driver_review_items (driver_id, item, photo_path, status, reviewed_by, reviewed_at)
  values ('${D1}', 'insurance_card', 'insurance/legacy-1.jpg', 'approved', '${ADMIN}', now())`);
ok('approved current card is eligible', (await reason(D1)) === null, await reason(D1));
r = await commitAs('authenticated', ADMIN, `insert into job_offers (delivery_id, driver_id, expires_at) values ('${DEL}', '${D1}', now() + interval '15 minutes') returning id`);
ok('offer to approved driver allowed', r.rows && r.rows.length === 1, r.error?.message);
const offerId = r.rows?.[0]?.id;

// Driver edits the expiry (no new card) -> insurance review goes back to pending -> blocked.
r = await commitAs('authenticated', P1, `update drivers set insurance_expiry = insurance_expiry + 365 where id = '${D1}' returning id`);
ok('driver can update own insurance expiry', r.rows && r.rows.length === 1, r.error?.message);
let row = (await db.query(`select status, photo_path from driver_review_items where driver_id = '${D1}' and item = 'insurance_card'`)).rows[0];
ok('insurance change re-queues review as pending (legacy path kept)', row.status === 'pending' && row.photo_path === 'insurance/legacy-1.jpg', JSON.stringify(row));
ok('pending insurance is blocked', (await reason(D1)) === 'Insurance card is waiting for dispatch review', await reason(D1));

r = await as('service_role', null, `update job_offers set status = 'accepted' where id = '${offerId}' returning id`);
ok('accepting an open offer while blocked is refused', r.error && r.error.code === '42501', r.error?.message);
r = await as('service_role', null, `update deliveries set driver_id = '${D1}', status = 'assigned' where id = '${DEL}' returning id`);
ok('accept-style assignment while blocked is refused (service role)', r.error && r.error.code === '42501', r.error?.message);

// Driver uploads a new card into their own folder -> pending with the new path.
r = await commitAs('authenticated', P1, `update drivers set insurance_card_url = 'drivers/${P1}/insurance_card-1.jpg' where id = '${D1}' returning id`);
ok('driver can set a new card in own folder', r.rows && r.rows.length === 1, r.error?.message);
row = (await db.query(`select status, photo_path from driver_review_items where driver_id = '${D1}' and item = 'insurance_card'`)).rows[0];
ok('new card queued pending with new path', row.status === 'pending' && row.photo_path === `drivers/${P1}/insurance_card-1.jpg`, JSON.stringify(row));

// Staff approves the OLD path by mistake -> still blocked (path mismatch).
await commitAs('service_role', null, `update driver_review_items set status = 'approved', photo_path = 'insurance/legacy-1.jpg' where driver_id = '${D1}' and item = 'insurance_card'`);
ok('approval of a stale file does not unblock', (await reason(D1)) === 'Insurance card changed and needs dispatch review', await reason(D1));
await commitAs('service_role', null, `update driver_review_items set status = 'approved', photo_path = 'drivers/${P1}/insurance_card-1.jpg' where driver_id = '${D1}' and item = 'insurance_card'`);
ok('approval of the current file unblocks', (await reason(D1)) === null, await reason(D1));

r = await as('service_role', null, `update deliveries set driver_id = '${D1}', status = 'assigned' where id = '${DEL}' returning id`);
ok('assignment allowed once approved', r.rows && r.rows.length === 1, r.error?.message);

// Rejected -> blocked.
await commitAs('service_role', null, `update driver_review_items set status = 'rejected', reason = 'Wrong name' where driver_id = '${D1}' and item = 'insurance_card'`);
ok('rejected card is blocked', (await reason(D1)) === 'Insurance card was rejected by dispatch', await reason(D1));

// In-progress job is never touched: assign while eligible, then expire, then update status.
await commitAs('service_role', null, `update driver_review_items set status = 'approved', reason = null where driver_id = '${D1}' and item = 'insurance_card'`);
await commitAs('service_role', null, `update deliveries set driver_id = '${D1}', status = 'assigned' where id = '${DEL2}'`);
await db.exec(`update drivers set insurance_expiry = (now() at time zone 'America/Los_Angeles')::date - 1 where id = '${D1}'`);
ok('after expiry the driver is blocked', /^Insurance expired/.test(await reason(D1) || ''), await reason(D1));
r = await as('service_role', null, `update deliveries set status = 'picked_up' where id = '${DEL2}' returning id`);
ok('in-progress job status update still allowed after expiry', r.rows && r.rows.length === 1, r.error?.message);
r = await as('service_role', null, `update deliveries set driver_id = null, status = 'booked' where id = '${DEL2}' returning id`);
ok('releasing a job (driver_id -> null) still allowed', r.rows && r.rows.length === 1, r.error?.message);

// Expiry today counts as current.
await db.exec(`update drivers set insurance_expiry = (now() at time zone 'America/Los_Angeles')::date where id = '${D1}'`);
ok('expiry date of today (Pacific) is still current', (await reason(D1)) === null, await reason(D1));
await db.exec(`update drivers set insurance_expiry = null where id = '${D1}'`);
ok('null expiry is blocked', (await reason(D1)) === 'No insurance expiry date on file', await reason(D1));

// ---- Dimensions queue + new applicant insert ----
const P3 = '99999999-9999-9999-9999-999999999999';
await db.exec(`insert into profiles values ('${P3}', 'driver')`);
r = await commitAs('authenticated', P3, `insert into drivers (profile_id, vehicle_type, insurance_expiry, insurance_card_url, registration_url,
    vehicle_photo_front_url, vehicle_photo_cargo_url, cargo_length_in, cargo_width_in, cargo_height_in, cargo_capacity_lbs)
  values ('${P3}', 'van', current_date + 100, 'drivers/${P3}/insurance_card-1.jpg', 'drivers/${P3}/registration-1.jpg',
    'drivers/${P3}/vehicle_front-1.jpg', 'drivers/${P3}/vehicle_cargo-1.jpg', 120, 60, 50, 2000) returning id`);
ok('new applicant insert with own-folder paths works', r.rows && r.rows.length === 1, r.error?.message);
const D3 = r.rows?.[0]?.id;
const items3 = (await db.query(`select item, status from driver_review_items where driver_id = '${D3}' order by item`)).rows;
ok('applicant insert queues pending rows for each provided group',
  JSON.stringify(items3.map((x) => x.item)) === JSON.stringify(['cargo_dimensions', 'insurance_card', 'registration', 'vehicle_cargo', 'vehicle_front'])
  && items3.every((x) => x.status === 'pending'), JSON.stringify(items3));

r = await as('authenticated', P3, `insert into drivers (profile_id, insurance_card_url) values ('${P3}', 'drivers/${P1}/x.jpg') returning id`);
ok('applicant insert pointing at another folder refused', r.error && r.error.code === '42501', r.error?.message);
r = await as('authenticated', P3, `insert into drivers (profile_id, insurance_card_url) values ('${P3}', 'insurance/123-abc.jpg') returning id`);
ok('N1: applicant insert with a shared legacy folder path refused', r.error && r.error.code === '42501', r.error?.message || 'inserted');

await commitAs('service_role', null, `update driver_review_items set status = 'approved' where driver_id = '${D3}' and item = 'cargo_dimensions'`);
await commitAs('authenticated', P3, `update drivers set cargo_capacity_lbs = 2500 where id = '${D3}'`);
row = (await db.query(`select status, photo_path from driver_review_items where driver_id = '${D3}' and item = 'cargo_dimensions'`)).rows[0];
ok('dimension change re-queues dimensions as pending', row.status === 'pending' && row.photo_path === null, JSON.stringify(row));

// Staff edits never queue a review.
await commitAs('service_role', null, `update driver_review_items set status = 'approved' where driver_id = '${D3}' and item = 'registration'`);
await commitAs('authenticated', ADMIN, `update drivers set registration_expiry = current_date + 200 where id = '${D3}'`);
row = (await db.query(`select status from driver_review_items where driver_id = '${D3}' and item = 'registration'`)).rows[0];
ok('staff edit does not reset review', row.status === 'approved', JSON.stringify(row));

// Function privileges.
r = await as('authenticated', P1, `select public.driver_offer_block_reason('${D2}')`);
ok('drivers cannot call driver_offer_block_reason directly', !!r.error);


// ================= AEQUALIS QA PROBES (Phase 0 interaction) =================
const trg = (await db.query(`select tgname from pg_trigger where tgrelid = 'public.drivers'::regclass and not tgisinternal order by tgname`)).rows.map(x=>x.tgname);
console.log('QA drivers triggers (alpha order):', JSON.stringify(trg));
r = await as('authenticated', P1, `update drivers set status = 'suspended', insurance_expiry = current_date + 400 where id = '${D1}' returning id`);
ok('QA phase0 still blocks driver status change alongside P-366 columns', r.error && r.error.code === '42501', r.error?.message || 'updated');
r = await as('authenticated', P1, `update drivers set rating = 1 where id = '${D1}' returning id`);
ok('QA phase0 still blocks rating change', r.error && r.error.code === '42501', r.error?.message);
const P4 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
await db.exec(`insert into profiles values ('${P4}', 'driver')`);
r = await commitAs('authenticated', P4, `insert into drivers (profile_id, status, rating, insurance_card_url, insurance_expiry)
   values ('${P4}', 'active', 5, 'drivers/${P4}/insurance_card-1.jpg', current_date + 100) returning id, status, updated_at`);
ok('QA applicant insert: phase0 forces status pending, P-366 queue still fires', r.rows && r.rows[0].status === 'pending', r.error?.message || JSON.stringify(r.rows));
const D4 = r.rows?.[0]?.id;
const q4 = (await db.query(`select item, status from driver_review_items where driver_id = '${D4}'`)).rows;
ok('QA applicant insert queued insurance_card pending once', q4.length === 1 && q4[0].status === 'pending', JSON.stringify(q4));
// legacy cross-driver file on INSERT
const P5 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
await db.exec(`insert into profiles values ('${P5}', 'driver')`);
r = await commitAs('authenticated', P5, `insert into drivers (profile_id, insurance_card_url) values ('${P5}', 'insurance/legacy-2.jpg') returning id`);
ok('N1 (QA finding fixed): applicant cannot INSERT another driver legacy file path', r.error && r.error.code === '42501', r.error?.message || 'inserted');
const q5 = (await db.query(`select count(*)::int n from driver_review_items where photo_path = 'insurance/legacy-2.jpg'`)).rows;
ok('N1: no review row points at the foreign legacy file', q5[0].n === 0, JSON.stringify(q5));
// blocked driver can still set current_delivery_id to assigned in-progress job
await db.exec(`update deliveries set driver_id = '${D1}', status='in_transit' where id = '${DEL2}'`);
await db.exec(`update drivers set insurance_expiry = (now() at time zone 'America/Los_Angeles')::date - 5 where id = '${D1}'`);
ok('QA D1 is blocked (expired)', /^Insurance expired/.test(await reason(D1) || ''), await reason(D1));
r = await as('authenticated', P1, `update drivers set current_delivery_id = '${DEL2}' where id = '${D1}' returning id`);
ok('QA blocked driver can still set current_delivery_id on own in-progress job', r.rows && r.rows.length === 1, r.error?.message);
r = await as('service_role', null, `update deliveries set driver_id = '${D1}', status = 'delivered' where id = '${DEL2}' returning id`);
ok('QA status update that re-sends same driver_id still allowed', r.rows && r.rows.length === 1, r.error?.message);
r = await as('authenticated', P1, `update drivers set current_delivery_id = '${DEL}' where id = '${D1}' returning id`);
ok('QA phase0 current_delivery_id guard still fires', r.error && r.error.code === '42501', r.error?.message || 'updated');
// driver cannot touch another driver row
r = await as('authenticated', P1, `update drivers set insurance_expiry = current_date + 999 where id = '${D2}' returning id`);
ok('QA driver cannot update another driver row (0 rows)', r.rows && r.rows.length === 0, r.error?.message);
// driver cannot unblock self via direct REST: insert/upsert own insurance row approved
r = await as('authenticated', P1, `insert into driver_review_items (driver_id,item,photo_path,status) values ('${D1}','insurance_card','drivers/${P1}/insurance_card-1.jpg','approved')
   on conflict (driver_id,item) do update set status='approved' returning status`);
ok('QA driver upsert of own insurance as approved lands pending', r.rows && r.rows[0].status === 'pending', r.error?.message || JSON.stringify(r.rows));
// race: driver changes expiry after staff loaded, staff upsert approves same path -> unseen expiry approved
await db.exec(`update drivers set insurance_expiry = (now() at time zone 'America/Los_Angeles')::date + 30 where id = '${D1}'`);
await commitAs('service_role', null, `update driver_review_items set status='approved', photo_path=(select insurance_card_url from drivers where id='${D1}') where driver_id='${D1}' and item='insurance_card'`);
ok('QA baseline approved', (await reason(D1)) === null, await reason(D1));
await commitAs('authenticated', P1, `update drivers set insurance_expiry = insurance_expiry + 3000 where id = '${D1}'`);
ok('QA driver expiry edit re-blocks', (await reason(D1)) === 'Insurance card is waiting for dispatch review', await reason(D1));


// ================= Revision round 2026-10-28 =================
// Gear: declared, photo optional (R12).
r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path, owned) values ('${D1}', 'boots', null, true) returning status, owned`);
ok('R12: driver declares gear without a photo', r.rows && r.rows[0].status === 'pending' && r.rows[0].owned === true, r.error?.message);
r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D1}', 'vehicle_cargo', null) returning id`);
ok('vehicle/document items still need a photo', r.error && r.error.code === '42501', r.error?.message || 'inserted');
await commitAs('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D1}', 'mask', 'drivers/${P1}/mask-1.jpg') on conflict (driver_id, item) do nothing`);
r = await as('authenticated', P1, `update driver_review_items set owned = false where driver_id = '${D1}' and item = 'mask' returning owned, status`);
ok('R12: driver can un-declare gear (owned=false)', r.rows && r.rows[0].owned === false && r.rows[0].status === 'pending', r.error?.message);

// ID badge photo: only after approval (R1).
r = await as('authenticated', P3, `insert into driver_review_items (driver_id, item, photo_path) values ('${D3}', 'id_badge_photo', 'drivers/${P3}/id_badge_photo-1.jpg') returning id`);
ok('R1: pending applicant cannot add the ID badge photo', r.error && r.error.code === '42501', r.error?.message || 'inserted');
r = await as('authenticated', P1, `insert into driver_review_items (driver_id, item, photo_path) values ('${D1}', 'id_badge_photo', 'drivers/${P1}/id_badge_photo-1.jpg') returning status`);
ok('R1: approved (active) driver can add the ID badge photo, lands pending', r.rows && r.rows[0].status === 'pending', r.error?.message);

// deliveries.required_equipment
r = await as('service_role', null, `update deliveries set required_equipment = array['hi_vis_vest','boots'] where id = '${DEL}' returning required_equipment`);
ok('required_equipment accepts gear ids', r.rows && r.rows.length === 1, r.error?.message);
r = await as('service_role', null, `update deliveries set required_equipment = array['hi_vis_vest','jetpack'] where id = '${DEL}' returning id`);
ok('required_equipment refuses unknown ids', r.error && r.error.code === '23514', r.error?.message || 'updated');
const reDefault = (await db.query(`select required_equipment from deliveries where id = '${DEL2}'`)).rows[0].required_equipment;
ok('required_equipment defaults to empty for existing jobs', Array.isArray(reDefault) && reDefault.length === 0, JSON.stringify(reDefault));

// QA N3: privileges.
const privs = (await db.query(`select privilege_type from information_schema.role_table_grants
  where table_name = 'driver_review_items' and grantee = 'authenticated' order by 1`)).rows.map((x) => x.privilege_type);
ok('N3: authenticated has exactly SELECT, INSERT, UPDATE', JSON.stringify(privs) === JSON.stringify(['INSERT', 'SELECT', 'UPDATE']), JSON.stringify(privs));
const anonPrivs = (await db.query(`select count(*)::int n from information_schema.role_table_grants
  where table_name = 'driver_review_items' and grantee in ('anon', 'PUBLIC')`)).rows[0].n;
ok('N3: anon and PUBLIC have no privileges', anonPrivs === 0, String(anonPrivs));

// Review version (N2 support): every driver write bumps uploaded_at.
const before = (await db.query(`select uploaded_at from driver_review_items where driver_id = '${D1}' and item = 'insurance_card'`)).rows[0].uploaded_at;
await new Promise((res) => setTimeout(res, 15));
await commitAs('authenticated', P1, `update drivers set insurance_policy = 'POL-NEW' where id = '${D1}'`);
const after = (await db.query(`select uploaded_at from driver_review_items where driver_id = '${D1}' and item = 'insurance_card'`)).rows[0].uploaded_at;
ok('N2: a driver insurance edit bumps the review version (uploaded_at)', new Date(after).getTime() > new Date(before).getTime(), `${before} -> ${after}`);
await commitAs('service_role', null, `update driver_review_items set status = 'approved' where driver_id = '${D1}' and item = 'insurance_card'`);
const staffAfter = (await db.query(`select uploaded_at from driver_review_items where driver_id = '${D1}' and item = 'insurance_card'`)).rows[0].uploaded_at;
ok('N2: a staff review does not change the version', new Date(staffAfter).getTime() === new Date(after).getTime(), `${after} -> ${staffAfter}`);

// ================= Required items block new work (0600, ruling 2026-10-28) =================
await db.exec(mig('20261028000600_p366_required_items_block.sql'));
await db.exec(mig('20261028000600_p366_required_items_block.sql'));
ok('0600 applies twice without error', true);

const P6 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
await db.exec(`insert into profiles values ('${P6}', 'driver')`);
r = await commitAs('service_role', null, `insert into drivers (profile_id, status, vehicle_type, insurance_expiry, insurance_card_url, registration_url,
    vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_side_url, vehicle_photo_cargo_url,
    cargo_length_in, cargo_width_in, cargo_height_in, cargo_capacity_lbs)
  values ('${P6}', 'active', 'van', current_date + 100, 'drivers/${P6}/ins.jpg', 'drivers/${P6}/reg.jpg',
    'drivers/${P6}/f.jpg', 'drivers/${P6}/b.jpg', 'drivers/${P6}/s.jpg', 'drivers/${P6}/c.jpg', 120, 60, 50, 2000) returning id`);
const D6 = r.rows?.[0]?.id;
await commitAs('service_role', null, `insert into driver_review_items (driver_id, item, photo_path, status) values ('${D6}', 'insurance_card', 'drivers/${P6}/ins.jpg', 'approved')`);
ok('A: fully uploaded driver with approved insurance is not blocked (others unreviewed)', (await reason(D6)) === null, await reason(D6));

await db.exec(`update drivers set vehicle_photo_cargo_url = null where id = '${D6}'`);
ok('A: missing photo blocks', (await reason(D6)) === 'Missing required items: Cargo area', await reason(D6));
await db.exec(`update drivers set vehicle_photo_front_url = null, cargo_height_in = null, registration_url = null where id = '${D6}'`);
ok('A: missing items listed in config order',
  (await reason(D6)) === 'Missing required items: Vehicle - front, Cargo area, Cargo size and capacity, Vehicle registration', await reason(D6));
r = await as('service_role', null, `insert into job_offers (delivery_id, driver_id, expires_at) values ('${DEL}', '${D6}', now() + interval '15 minutes') returning id`);
ok('A: offer to a driver missing required items refused (service role)', r.error && r.error.code === '42501' && /Missing required items/.test(r.error.message), r.error?.message || 'inserted');
await db.exec(`update drivers set vehicle_photo_front_url = 'drivers/${P6}/f.jpg', vehicle_photo_cargo_url = 'drivers/${P6}/c.jpg',
  cargo_height_in = 50, registration_url = 'drivers/${P6}/reg.jpg' where id = '${D6}'`);
ok('A: all back on file unblocks', (await reason(D6)) === null, await reason(D6));

await db.exec(`update drivers set cargo_capacity_lbs = null where id = '${D6}'`);
ok('A: incomplete dimensions block', (await reason(D6)) === 'Missing required items: Cargo size and capacity', await reason(D6));
await db.exec(`update drivers set cargo_capacity_lbs = 2000 where id = '${D6}'`);

await commitAs('service_role', null, `insert into driver_review_items (driver_id, item, photo_path, status, reason) values ('${D6}', 'vehicle_side', 'drivers/${P6}/s.jpg', 'rejected', 'Too dark')`);
ok('A: rejected current file blocks', (await reason(D6)) === 'Rejected items need a new upload: Vehicle - side', await reason(D6));
r = await commitAs('authenticated', P6, `update drivers set vehicle_photo_side_url = 'drivers/${P6}/s2.jpg' where id = '${D6}' returning id`);
row = (await db.query(`select status, photo_path from driver_review_items where driver_id = '${D6}' and item = 'vehicle_side'`)).rows[0];
ok('A: re-upload resets the rejected row to pending', row.status === 'pending' && row.photo_path === `drivers/${P6}/s2.jpg`, JSON.stringify(row) + (r.error?.message || ''));
ok('A: re-uploaded (pending) item does not block', (await reason(D6)) === null, await reason(D6));

await commitAs('service_role', null, `insert into driver_review_items (driver_id, item, photo_path, status, reason) values ('${D6}', 'vehicle_back', 'drivers/${P6}/old-b.jpg', 'rejected', 'x')`);
ok('A: a rejection of an older file does not block', (await reason(D6)) === null, await reason(D6));
await commitAs('service_role', null, `insert into driver_review_items (driver_id, item, photo_path, status, reason) values ('${D6}', 'cargo_dimensions', null, 'rejected', 'Wrong')`);
ok('A: rejected dimensions block', (await reason(D6)) === 'Rejected items need a new upload: Cargo size and capacity', await reason(D6));
await db.exec(`update drivers set vehicle_photo_front_url = null where id = '${D6}'`);
ok('A: missing beats rejected', (await reason(D6)) === 'Missing required items: Vehicle - front', await reason(D6));
await db.exec(`update drivers set vehicle_photo_front_url = 'drivers/${P6}/f.jpg' where id = '${D6}'`);
await commitAs('service_role', null, `update driver_review_items set status = 'pending', reason = null where driver_id = '${D6}' and item = 'cargo_dimensions'`);
ok('A: pending dimensions do not block', (await reason(D6)) === null, await reason(D6));

await db.exec(`update drivers set registration_expiry = current_date - 10 where id = '${D6}'`);
ok('A: expired registration does not block', (await reason(D6)) === null, await reason(D6));
await commitAs('service_role', null, `insert into driver_review_items (driver_id, item, photo_path, status, reason, owned)
  values ('${D6}', 'hand_truck', 'drivers/${P6}/ht.jpg', 'rejected', 'Blurry', true)`);
ok('A: rejected gear never blocks', (await reason(D6)) === null, await reason(D6));

await db.exec(`update drivers set insurance_card_url = null, vehicle_photo_front_url = null where id = '${D6}'`);
ok('A: insurance reason still comes first', (await reason(D6)) === 'No insurance card on file', await reason(D6));
await db.exec(`update drivers set insurance_card_url = 'drivers/${P6}/ins.jpg', vehicle_photo_front_url = 'drivers/${P6}/f.jpg' where id = '${D6}'`);
await db.exec(`update drivers set insurance_expiry = current_date - 3 where id = '${D6}'`);
ok('A: expired insurance still reported first', /^Insurance expired on /.test(await reason(D6) || ''), await reason(D6));
await db.exec(`update drivers set insurance_expiry = current_date + 100 where id = '${D6}'`);
r = await as('authenticated', P6, `select public.driver_offer_block_reason('${D6}')`);
ok('A: drivers still cannot call the function directly', !!r.error);

// ================= Grace for the required-items block (0650, ruling 2026-10-28) =================
await db.exec(mig('20261028000650_p366_required_items_grace.sql'));
const ig1 = (await db.query(`select items_required_from::text d from drivers where id = '${D6}'`)).rows[0].d;
await db.exec(mig('20261028000650_p366_required_items_grace.sql'));
const ig2 = (await db.query(`select items_required_from::text d from drivers where id = '${D6}'`)).rows[0].d;
const igToday14 = (await db.query(`select ((now() at time zone 'America/Los_Angeles')::date + 14)::text d`)).rows[0].d;
ok('D: 0650 applies twice; active driver backfilled to today + 14, not extended by a re-run', ig1 === igToday14 && ig2 === ig1, `${ig1} ${ig2} ${igToday14}`);
const igPend = (await db.query(`select count(*)::int n from drivers where status <> 'active' and items_required_from is not null`)).rows[0].n;
ok('D: non-active drivers get no grace date', igPend === 0, String(igPend));

await db.exec(`update drivers set vehicle_photo_cargo_url = null, registration_url = null where id = '${D6}'`);
ok('D: in grace, missing items do not block', (await reason(D6)) === null, await reason(D6));
r = await as('service_role', null, `insert into job_offers (delivery_id, driver_id, expires_at) values ('${DEL}', '${D6}', now() + interval '15 minutes') returning id`);
ok('D: in grace, an offer is allowed', r.rows && r.rows.length === 1, r.error?.message);
await db.exec(`update drivers set insurance_expiry = current_date - 2 where id = '${D6}'`);
ok('D: insurance has no grace', /^Insurance expired on /.test(await reason(D6) || ''), await reason(D6));
await db.exec(`update drivers set insurance_expiry = current_date + 100 where id = '${D6}'`);

r = await as('authenticated', P6, `update drivers set items_required_from = current_date + 365 where id = '${D6}' returning id`);
ok('D: driver cannot move their own items date', r.error && r.error.code === '42501', r.error?.message || 'updated');
const P8 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
await db.exec(`insert into profiles values ('${P8}', 'driver')`);
r = await commitAs('authenticated', P8, `insert into drivers (profile_id, items_required_from) values ('${P8}', current_date + 365) returning items_required_from`);
ok('D: applicant insert cannot set an items date', r.rows && r.rows[0].items_required_from === null, r.error?.message || JSON.stringify(r.rows));

await db.exec(`update drivers set items_required_from = (now() at time zone 'America/Los_Angeles')::date where id = '${D6}'`);
ok('D: on the grace date the block applies', (await reason(D6)) === 'Missing required items: Cargo area, Vehicle registration', await reason(D6));
await db.exec(`update drivers set items_required_from = null where id = '${D6}'`);
ok('D: no date (approved after ship) blocks', (await reason(D6)) === 'Missing required items: Cargo area, Vehicle registration', await reason(D6));
await db.exec(`update drivers set vehicle_photo_cargo_url = 'drivers/${P6}/c.jpg', registration_url = 'drivers/${P6}/reg.jpg' where id = '${D6}'`);
ok('D: all on file again, not blocked', (await reason(D6)) === null, await reason(D6));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
