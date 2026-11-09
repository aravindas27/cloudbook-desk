-- Cloudbook Desk — online database setup for Supabase.
-- Run once in Supabase: SQL Editor → New query → paste everything → Run.
-- Safe to run again: it only creates what is missing.

-- 1. Who belongs to which firm. Rows are added by the owner (step 2 at the bottom), never by the app.
create table if not exists public.firm_members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  firm_id    text not null,
  role       text not null default 'member',
  created_at timestamptz not null default now()
);

-- 2. The firm's data: one record per firm, with a version number so two devices never overwrite each other.
create table if not exists public.desk_state (
  firm_id    text primary key,
  data       jsonb not null default '{}'::jsonb,
  version    bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- 3. One automatic copy per day (the data as it was before the first change that day), kept 180 days.
create table if not exists public.desk_snapshots (
  id         bigserial primary key,
  firm_id    text not null,
  snap_date  date not null,
  data       jsonb not null,
  version    bigint,
  created_at timestamptz not null default now(),
  unique (firm_id, snap_date)
);

-- Row Level Security: nobody can see or change anything unless a policy below allows it.
alter table public.firm_members   enable row level security;
alter table public.desk_state     enable row level security;
alter table public.desk_snapshots enable row level security;

-- The firm of the signed-in user (runs with owner rights so policies can look it up safely).
create or replace function public.my_firm()
returns text language sql stable security definer set search_path = ''
as $$ select firm_id from public.firm_members where user_id = (select auth.uid()) $$;
revoke all on function public.my_firm() from public, anon;
grant execute on function public.my_firm() to authenticated;

drop policy if exists "see own membership" on public.firm_members;
create policy "see own membership" on public.firm_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own firm data" on public.desk_state;
create policy "read own firm data" on public.desk_state
  for select to authenticated using (firm_id = (select public.my_firm()));

drop policy if exists "change own firm data" on public.desk_state;
create policy "change own firm data" on public.desk_state
  for update to authenticated
  using (firm_id = (select public.my_firm()))
  with check (firm_id = (select public.my_firm()));

drop policy if exists "read own firm copies" on public.desk_snapshots;
create policy "read own firm copies" on public.desk_snapshots
  for select to authenticated using (firm_id = (select public.my_firm()));

-- Table permissions: signed-in users may read, and may change only the data and version columns.
-- Anonymous visitors get nothing. Nobody can insert or delete through the app.
revoke all on public.firm_members, public.desk_state, public.desk_snapshots from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.firm_members to authenticated;
grant select on public.desk_state to authenticated;
grant update (data, version) on public.desk_state to authenticated;
grant select on public.desk_snapshots to authenticated;

-- Every save: version must go up by exactly one; stamp who and when; keep the daily copy.
create or replace function public.desk_state_before_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.version <> old.version + 1 then
    raise exception 'Version conflict: reload and try again';
  end if;
  new.firm_id    := old.firm_id;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if old.version > 0 then
    insert into public.desk_snapshots (firm_id, snap_date, data, version)
    values (old.firm_id, current_date, old.data, old.version)
    on conflict (firm_id, snap_date) do nothing;
    delete from public.desk_snapshots where firm_id = old.firm_id and snap_date < current_date - 180;
  end if;
  return new;
end $$;
revoke all on function public.desk_state_before_update() from public, anon, authenticated;

drop trigger if exists desk_state_before_update on public.desk_state;
create trigger desk_state_before_update before update on public.desk_state
  for each row execute function public.desk_state_before_update();

-- The firm's (empty) record.
insert into public.desk_state (firm_id) values ('cloudbook') on conflict (firm_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — run AFTER creating your login in Authentication → Users → Add user.
-- Replace the email if you used a different one, then run just this part.
-- ─────────────────────────────────────────────────────────────────────────────
-- insert into public.firm_members (user_id, firm_id, role)
-- select id, 'cloudbook', 'owner' from auth.users where email = 'aravind@cloudbookassociates.com'
-- on conflict (user_id) do nothing;
