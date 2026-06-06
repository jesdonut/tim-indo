-- Teams infrastructure
-- Run this in Supabase SQL Editor AFTER team_links.sql

-- ============================================================
-- 1. Teams
-- ============================================================
create table if not exists public.teams (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  invite_code text        not null unique,
  created_at  timestamptz default now()
);

alter table public.teams enable row level security;
grant select on public.teams to authenticated;
create policy "authenticated can read teams" on public.teams
  for select to authenticated using (true);

-- ============================================================
-- 2. Profiles (links auth users to a team)
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  team_id    uuid references public.teams(id),
  name       text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
create policy "team members can read team profiles" on public.profiles
  for select to authenticated using (team_id = public.my_team_id());
create policy "users can update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users can insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- ============================================================
-- 3. Helper: get current user's team_id
-- ============================================================
create or replace function public.my_team_id()
returns uuid language sql stable security definer as $$
  select team_id from public.profiles where id = auth.uid()
$$;

-- ============================================================
-- 4. Trigger: auto-create profile on signup
--    Reads invite_code + name from user metadata
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id
  from public.teams
  where invite_code = (new.raw_user_meta_data->>'invite_code');

  if v_team_id is not null then
    insert into public.profiles (id, team_id, name)
    values (
      new.id,
      v_team_id,
      coalesce(new.raw_user_meta_data->>'name', new.email)
    )
    on conflict (id) do nothing;

    -- Cache team_id in metadata so proxy can check without a DB query
    update auth.users
    set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('team_id', v_team_id::text)
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 5. Seed: Tim Indo team
-- ============================================================
insert into public.teams (id, name, invite_code)
values ('11111111-1111-1111-1111-111111111111', 'Tim Indo Serba Bisa', 'grasp2026indo')
on conflict (invite_code) do nothing;

-- ============================================================
-- 6. Update team_links to be team-scoped
-- ============================================================
alter table public.team_links add column if not exists team_id uuid references public.teams(id);
update public.team_links set team_id = '11111111-1111-1111-1111-111111111111' where team_id is null;

drop policy if exists "authenticated users can read links" on public.team_links;
drop policy if exists "authenticated users can insert links" on public.team_links;
drop policy if exists "authenticated users can delete links" on public.team_links;

create policy "team members can read links" on public.team_links
  for select to authenticated using (team_id = public.my_team_id());
create policy "team members can insert links" on public.team_links
  for insert to authenticated with check (team_id = public.my_team_id());
create policy "team members can delete links" on public.team_links
  for delete to authenticated using (team_id = public.my_team_id());

-- ============================================================
-- 7. Team notes — recreate with team_id
-- ============================================================
drop table if exists public.team_notes;
create table public.team_notes (
  team_id    uuid        primary key references public.teams(id),
  content    text        not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id) on delete set null
);

alter table public.team_notes enable row level security;
create policy "team members can read notes" on public.team_notes
  for select to authenticated using (team_id = public.my_team_id());
create policy "team members can write notes" on public.team_notes
  for all to authenticated using (team_id = public.my_team_id())
  with check (team_id = public.my_team_id());

insert into public.team_notes (team_id, content)
values ('11111111-1111-1111-1111-111111111111', '')
on conflict (team_id) do nothing;

alter publication supabase_realtime add table public.team_notes;
