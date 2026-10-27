-- ADMIN ROSTER STEP 1 (P-352, applied live 2026-10-27)
-- Promote rico@epyccs.com now. Step 2 (20261027000001_admin_roster.sql) runs
-- once admin@epyccs.com exists and removes all other admins.
UPDATE public.profiles p SET role = 'admin', updated_at = now() FROM auth.users u WHERE u.id = p.id AND lower(u.email) = 'rico@epyccs.com';
