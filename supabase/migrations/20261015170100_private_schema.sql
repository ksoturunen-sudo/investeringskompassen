-- Flytta behörighetskontrollen till ett schema som inte exponeras via API:t.
create schema if not exists ik_private;
revoke all on schema ik_private from public, anon;
grant usage on schema ik_private to authenticated, service_role;

create or replace function ik_private.is_allowed()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ik_allowed_users
    where email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;
revoke all on function ik_private.is_allowed() from public, anon;
grant execute on function ik_private.is_allowed() to authenticated;

drop policy ik_vaults_select on public.ik_vaults;
drop policy ik_vaults_insert on public.ik_vaults;
drop policy ik_vaults_update on public.ik_vaults;
create policy ik_vaults_select on public.ik_vaults for select to authenticated
  using (user_id = (select auth.uid()) and (select ik_private.is_allowed()));
create policy ik_vaults_insert on public.ik_vaults for insert to authenticated
  with check (user_id = (select auth.uid()) and (select ik_private.is_allowed()));
create policy ik_vaults_update on public.ik_vaults for update to authenticated
  using (user_id = (select auth.uid()) and (select ik_private.is_allowed()))
  with check (user_id = (select auth.uid()));
drop function public.ik_is_allowed();
