// PGlite test for 20261028000400_p358_price_integrity.sql (P-358).
// Not part of the vitest suite (PGlite is not a repo dependency). To run:
//   mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite@0.3
//   cp <repo>/packages/supabase/tests/p358_price_integrity.pglite.mjs .
//   node p358_price_integrity.pglite.mjs <repo-root>
// Builds a minimal Supabase-like scaffold (roles, auth.uid(), live insert
// policies, caller_is_staff()), applies 000200 then 000400 twice, and checks
// customer/anon/driver/admin/service-role inserts and the proof path rule.
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

const CUST = '11111111-1111-1111-1111-111111111111';
const ADMIN = '22222222-2222-2222-2222-222222222222';
const DRVP = '33333333-3333-3333-3333-333333333333';
const DRV = '44444444-4444-4444-4444-444444444444';
const DEL = '55555555-5555-5555-5555-555555555555';

// Minimal Supabase-like scaffold. Columns trimmed to what the triggers touch.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create table public.profiles (id uuid primary key, role varchar default 'customer');
  create table public.drivers (id uuid primary key, profile_id uuid);
  create table public.deliveries (
    id uuid primary key default gen_random_uuid(),
    tracking_number text not null unique,
    customer_id uuid not null, company_id uuid, driver_id uuid,
    status text default 'quote_requested',
    pickup_address text not null, pickup_city text not null, pickup_state text not null, pickup_zip text not null,
    delivery_address text not null, delivery_city text not null, delivery_state text not null, delivery_zip text not null,
    actual_pickup_time timestamptz, actual_delivery_time timestamptz,
    total_price numeric, base_price numeric, driver_payout numeric, tip_amount numeric default 0,
    booked_at timestamptz, assigned_at timestamptz,
    source text default 'direct', source_reference text
  );
  create table public.proof_of_delivery (
    id uuid primary key default gen_random_uuid(),
    delivery_id uuid not null references public.deliveries(id),
    type text not null, stage text not null default 'delivery', photo_kind text, photo_url text
  );
  alter table public.deliveries enable row level security;
  alter table public.proof_of_delivery enable row level security;
  create policy "Customers can create deliveries" on public.deliveries for insert with check (customer_id = auth.uid());
  create policy deliveries_staff_insert on public.deliveries for insert to authenticated with check
    (exists (select 1 from profiles where id = auth.uid() and role in ('admin','dispatcher')));
  create policy sel on public.deliveries for select using (true);
  create policy pod_driver_insert on public.proof_of_delivery for insert to authenticated with check
    (exists (select 1 from deliveries d join drivers dr on dr.id = d.driver_id
             where d.id = proof_of_delivery.delivery_id and dr.profile_id = auth.uid()));
  create policy pod_sel on public.proof_of_delivery for select using (true);
  grant select on public.profiles, public.drivers to anon, authenticated, service_role;
  grant select, insert, update on public.deliveries, public.proof_of_delivery to anon, authenticated, service_role;

  -- caller_is_staff() as in 20261027000000_phase0_security_lockdown.sql
  create or replace function public.caller_is_staff() returns boolean language plpgsql stable
  set search_path to 'public' as $f$
  begin
    if current_user not in ('authenticated', 'anon') then return true; end if;
    return exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','dispatcher'));
  end; $f$;
  grant execute on function public.caller_is_staff() to anon, authenticated, service_role;

  insert into profiles values ('${CUST}','customer'), ('${ADMIN}','admin'), ('${DRVP}','driver');
  insert into drivers values ('${DRV}', '${DRVP}');
  insert into deliveries (id, tracking_number, customer_id, driver_id, status,
    pickup_address, pickup_city, pickup_state, pickup_zip, delivery_address, delivery_city, delivery_state, delivery_zip)
  values ('${DEL}', 'EPYCSEED', '${CUST}', '${DRV}', 'arrived_delivery', 'a','b','CA','90001','c','d','CA','90002');
  -- An existing proof row with a legacy (non-conforming) path: must survive.
  insert into proof_of_delivery (delivery_id, type, photo_url) values ('${DEL}', 'photo', 'legacy/old.jpg');
`);

// Apply the prior guard, then the new migration, then the new migration again (re-run safety).
await db.exec(mig('20261028000200_deliveries_insert_guard.sql'));
await db.exec(mig('20261028000400_p358_price_integrity.sql'));
await db.exec(mig('20261028000400_p358_price_integrity.sql'));
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

const delInsert = (cust, extra = '', vals = '') => `
  insert into deliveries (tracking_number, customer_id, status, total_price${extra},
    pickup_address, pickup_city, pickup_state, pickup_zip, delivery_address, delivery_city, delivery_state, delivery_zip)
  values ('EPYC' || substr(md5(random()::text),1,8), '${cust}', 'booked', 1.00${vals}, 'a','b','CA','90001','c','d','CA','90002')
  returning total_price, company_id, tip_amount, status`;

// 1. Customer direct insert at an altered price: refused 42501.
let r = await as('authenticated', CUST, delInsert(CUST, ', company_id, tip_amount', `, gen_random_uuid(), 500`));
ok('customer direct insert refused', r.error && r.error.code === '42501', r.error?.message);
ok('customer refusal message names the booking service', /booking service/.test(r.error?.message || ''));

// 1b. Customer direct insert even with no price fields: refused.
r = await as('authenticated', CUST, `insert into deliveries (tracking_number, customer_id,
  pickup_address, pickup_city, pickup_state, pickup_zip, delivery_address, delivery_city, delivery_state, delivery_zip)
  values ('EPYCX1', '${CUST}', 'a','b','CA','90001','c','d','CA','90002') returning id`);
ok('customer insert without price refused', r.error && r.error.code === '42501', r.error?.message);

// 1c. Anon refused; driver refused.
r = await as('anon', null, delInsert(CUST));
ok('anon insert refused', !!r.error, '');
r = await as('authenticated', DRVP, delInsert(DRVP));
ok('driver insert refused (42501)', r.error && r.error.code === '42501', r.error?.message);

// 2. Service role (booking route, broker API) passes through untouched.
r = await as('service_role', null, delInsert(CUST));
ok('service role insert allowed', r.rows && r.rows.length === 1, r.error?.message);
ok('service role row keeps price, company NULL, tip default 0',
  r.rows && Number(r.rows[0].total_price) === 1 && r.rows[0].company_id === null && Number(r.rows[0].tip_amount) === 0,
  JSON.stringify(r.rows));

// 3. Admin (dispatch new-delivery page) passes through.
r = await as('authenticated', ADMIN, delInsert(CUST));
ok('admin insert allowed', r.rows && r.rows.length === 1, r.error?.message);

// 4. Proof photo path rule for drivers.
const pod = (path) => `insert into proof_of_delivery (delivery_id, type, stage, photo_kind, photo_url)
  values ('${DEL}', 'photo', 'delivery', 'placement', ${path === null ? 'null' : `'${path}'`}) returning photo_url`;
r = await as('authenticated', DRVP, pod(`${DEL}/delivery-placement-1761600000000-ab12.jpg`));
ok('driver proof with own folder accepted', r.rows && r.rows.length === 1, r.error?.message);
r = await as('authenticated', DRVP, pod(`${DEL}/exception-1761600000000.jpg`));
ok('driver exception photo path accepted', r.rows && r.rows.length === 1, r.error?.message);
r = await as('authenticated', DRVP, pod(null));
ok('driver proof row with no photo accepted', r.rows && r.rows.length === 1, r.error?.message);
for (const bad of [
  `00000000-0000-0000-0000-000000000000/x.jpg`,
  `${DEL}/../00000000-0000-0000-0000-000000000000/x.jpg`,
  `${DEL}/sub/x.jpg`,
  `${DEL}/a..b.jpg`,
  `${DEL}/`,
  `https://evil.example/${DEL}/x.jpg`,
  `x.jpg`,
]) {
  r = await as('authenticated', DRVP, pod(bad));
  ok(`driver proof path refused: ${bad}`, r.error && r.error.code === '42501', r.error?.message || 'inserted');
}
r = await as('service_role', null, pod('legacy/staff-path.jpg'));
ok('service role proof path not restricted', r.rows && r.rows.length === 1, r.error?.message);

// 5. Existing rows untouched; updating a non-path column of a legacy row still works.
const legacy = await db.query(`select count(*)::int n from proof_of_delivery where photo_url = 'legacy/old.jpg'`);
ok('existing legacy proof row still present', legacy.rows[0].n === 1);
r = await as('service_role', null, `update proof_of_delivery set photo_kind = 'other' where photo_url = 'legacy/old.jpg' returning id`);
ok('legacy row updatable on other columns', r.rows && r.rows.length === 1, r.error?.message);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
