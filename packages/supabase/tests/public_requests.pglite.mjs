// PGlite test for 20261118000000_public_requests.sql.
// Not part of the vitest suite (PGlite is not a repo dependency). To run:
//   mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite@0.3
//   cp <repo>/packages/supabase/tests/public_requests.pglite.mjs .
//   node public_requests.pglite.mjs <repo-root>
// Checks: migration applies twice; anon and signed-in non-staff cannot read,
// insert, or update the new tables; staff can read and update; service role
// can insert; reference is generated; driver signup copies only allowlisted
// screening answers and a safe resume path; non-driver signup is unchanged.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const mig = (f) => readFileSync(join(root, 'packages/supabase/migrations', f), 'utf8');
const db = new PGlite();
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra); }
};
const ADMIN = '22222222-2222-2222-2222-222222222222';
const USER = '33333333-3333-3333-3333-333333333333';

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table public.profiles (id uuid primary key, email text, full_name text, avatar_url text, role varchar default 'customer', phone text);
  create table public.driver_applications (
    id uuid primary key default gen_random_uuid(), profile_id uuid unique, full_name text, email text, phone text,
    status text default 'pending_review', profile_photo_path text, license_front_path text, license_back_path text,
    source text, notes text, created_at timestamptz default now(), updated_at timestamptz default now()
  );
  create or replace function public.caller_is_staff() returns boolean language plpgsql stable
  set search_path to 'public' as $f$
  begin
    if current_user not in ('authenticated', 'anon') then return true; end if;
    return exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','dispatcher'));
  end; $f$;
  grant execute on function public.caller_is_staff() to anon, authenticated, service_role;
  insert into public.profiles (id, role) values ('${ADMIN}', 'admin'), ('${USER}', 'customer');
`);

await db.exec(mig('20261118000000_public_requests.sql'));
await db.exec(mig('20261118000000_public_requests.sql'));
ok('migration applies twice', true);

await db.exec(`
  create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
  grant select, insert, update, delete on public.delivery_requests, public.contact_messages to anon, authenticated, service_role;
`);

const as = async (role, sub, sql) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims', '${JSON.stringify({ sub })}', false);`);
  try { return await db.query(sql); } finally { await db.exec('reset role;'); }
};
const tries = async (role, sub, sql) => { try { return { r: await as(role, sub, sql) }; } catch (e) { return { e }; } };

const ins = `insert into public.delivery_requests (contact_name, contact_phone, contact_email, pickup_address, dropoff_address, item_type)
             values ('Pat', '8185550100', 'p@x.com', '1 A St', '2 B St', 'medical') returning reference`;
const svc = await as('service_role', null, ins);
ok('service role can insert, reference generated', /^REQ-[0-9A-F]{8}$/.test(svc.rows[0].reference), svc.rows[0].reference);
await as('service_role', null, `insert into public.contact_messages (full_name, email, message) values ('Sam','s@x.com','hi')`);

ok('anon cannot insert request', !!(await tries('anon', '', ins)).e);
ok('signed-in non-staff cannot insert request', !!(await tries('authenticated', USER, ins)).e);
ok('anon reads no requests', (await as('anon', '', 'select * from public.delivery_requests')).rows.length === 0);
ok('non-staff reads no requests', (await as('authenticated', USER, 'select * from public.delivery_requests')).rows.length === 0);
ok('non-staff reads no messages', (await as('authenticated', USER, 'select * from public.contact_messages')).rows.length === 0);
const upd = await as('authenticated', USER, `update public.delivery_requests set status='booked' returning id`);
ok('non-staff cannot update', upd.rows.length === 0);
ok('staff reads requests', (await as('authenticated', ADMIN, 'select * from public.delivery_requests')).rows.length === 1);
ok('staff reads messages', (await as('authenticated', ADMIN, 'select * from public.contact_messages')).rows.length === 1);
const su = await as('authenticated', ADMIN, `update public.delivery_requests set status='contacted' returning status`);
ok('staff can update', su.rows[0]?.status === 'contacted');
ok('bad status rejected', !!(await tries('authenticated', ADMIN, `update public.delivery_requests set status='lol'`)).e);
const del = await as('authenticated', ADMIN, `delete from public.delivery_requests returning id`);
ok('staff cannot delete (no policy)', del.rows.length === 0);
ok('bad item type rejected', !!(await tries('service_role', null, ins.replace("'medical'", "'hazmat'"))).e);

const signup = (id, meta) =>
  db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`, [id, `${id.slice(0, 4)}@x.com`, JSON.stringify(meta)]);
await signup('aaaaaaaa-0000-0000-0000-000000000001', {
  role: 'driver', full_name: 'Ana', phone: '818', van_access: 'own_van', years_experience: '1_to_3',
  availability: 'full_time', resume_path: 'resumes/1700000000-abc123.pdf',
});
let a = (await db.query(`select * from public.driver_applications where email='aaaa@x.com'`)).rows[0];
ok('driver answers copied', a && a.van_access === 'own_van' && a.years_experience === '1_to_3' && a.availability === 'full_time');
ok('resume path copied', a?.resume_path === 'resumes/1700000000-abc123.pdf');
ok('application otherwise as before', a?.status === 'pending_review' && a?.source === 'web_register' && a?.full_name === 'Ana');

await signup('bbbbbbbb-0000-0000-0000-000000000002', {
  role: 'driver', van_access: 'spaceship', years_experience: "1'; drop table x", availability: '',
  resume_path: 'resumes/../license-front/x.jpg',
});
a = (await db.query(`select * from public.driver_applications where email='bbbb@x.com'`)).rows[0];
ok('unknown answers stored as null', a && a.van_access === null && a.years_experience === null && a.availability === null);
ok('unsafe resume path stored as null', a?.resume_path === null);

await signup('cccccccc-0000-0000-0000-000000000003', { role: 'admin', van_access: 'own_van' });
const p = (await db.query(`select role from public.profiles where id='cccccccc-0000-0000-0000-000000000003'`)).rows[0];
ok('admin role from signup still refused', p?.role === 'member');
ok('non-driver signup makes no application',
  (await db.query(`select count(*)::int n from public.driver_applications where email='cccc@x.com'`)).rows[0].n === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
