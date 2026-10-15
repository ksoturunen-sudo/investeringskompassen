-- Investeringskompassen: synk (krypterat valv) och kurscache.
-- Alla tabeller prefixas ik_ eftersom databasen delas med ett annat (inaktivt) projekt.

-- Vilka konton som får använda appen (skydd mot att främlingar förbrukar kurskvoten).
create table if not exists public.ik_allowed_users (
  email text primary key check (email = lower(email))
);
alter table public.ik_allowed_users enable row level security;
-- Inga policyer: bara servern (service role) kan läsa/ändra.

create or replace function public.ik_is_allowed()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ik_allowed_users
    where email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;
revoke all on function public.ik_is_allowed() from public, anon;
grant execute on function public.ik_is_allowed() to authenticated;

-- Krypterat valv: en rad per användare. Servern ser bara chiffertext.
create table if not exists public.ik_vaults (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  kdf jsonb not null,            -- { alg: "PBKDF2-SHA256", iterations, salt }
  iv text not null,
  ciphertext text not null check (length(ciphertext) <= 8000000),
  version bigint not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);
alter table public.ik_vaults enable row level security;

create policy ik_vaults_select on public.ik_vaults for select to authenticated
  using (user_id = (select auth.uid()) and (select public.ik_is_allowed()));
create policy ik_vaults_insert on public.ik_vaults for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.ik_is_allowed()));
create policy ik_vaults_update on public.ik_vaults for update to authenticated
  using (user_id = (select auth.uid()) and (select public.ik_is_allowed()))
  with check (user_id = (select auth.uid()));
create policy ik_vaults_delete on public.ik_vaults for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.ik_vaults from anon;
grant select, insert, update, delete on public.ik_vaults to authenticated;

create or replace function public.ik_touch_vault()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ik_vaults_touch on public.ik_vaults;
create trigger ik_vaults_touch before update on public.ik_vaults
  for each row execute function public.ik_touch_vault();

-- Kurscache (offentlig marknadsdata). Bara servern läser/skriver.
create table if not exists public.ik_instruments (
  isin text primary key check (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  symbol text,                 -- t.ex. "VOLV-B.ST"; null = hittades inte
  name text,
  type text,
  currency text,
  looked_up_at timestamptz not null default now()
);
create table if not exists public.ik_prices (
  symbol text not null,
  date date not null,
  close numeric not null,
  primary key (symbol, date)
);
create table if not exists public.ik_price_status (
  symbol text primary key,
  fetched_on date not null
);
create table if not exists public.ik_api_usage (
  day date primary key,
  calls integer not null default 0
);
alter table public.ik_instruments enable row level security;
alter table public.ik_prices enable row level security;
alter table public.ik_price_status enable row level security;
alter table public.ik_api_usage enable row level security;
revoke all on public.ik_instruments, public.ik_prices, public.ik_price_status, public.ik_api_usage from anon, authenticated;

-- Räknar API-anrop atomärt; returnerar false om dagens gräns är nådd.
create or replace function public.ik_take_api_call(p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  insert into public.ik_api_usage as u (day, calls) values ((now() at time zone 'Europe/Stockholm')::date, 1)
  on conflict (day) do update set calls = u.calls + 1
  where u.calls < p_limit
  returning calls into v;
  return v is not null;
end;
$$;
revoke all on function public.ik_take_api_call(integer) from public, anon, authenticated;
