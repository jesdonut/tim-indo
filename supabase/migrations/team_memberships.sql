-- Multi-team support: users can belong to multiple teams
-- Run in Supabase SQL Editor AFTER teams_setup.sql

-- ============================================================
-- 1. Team memberships junction table
-- ============================================================
create table if not exists public.team_memberships (
  user_id   uuid not null references auth.users(id) on delete cascade,
  team_id   uuid not null references public.teams(id) on delete cascade,
  role      text not null default 'member',  -- 'leader' | 'member'
  joined_at timestamptz default now(),
  primary key (user_id, team_id)
);

alter table public.team_memberships enable row level security;
grant select, insert, delete on public.team_memberships to authenticated;

create policy "users can read own memberships" on public.team_memberships
  for select to authenticated using (user_id = auth.uid());
create policy "users can join teams" on public.team_memberships
  for insert to authenticated with check (user_id = auth.uid());
create policy "users can leave teams" on public.team_memberships
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- 2. Allow creating and updating teams
-- ============================================================
grant insert, update on public.teams to authenticated;

create policy "authenticated can create teams" on public.teams
  for insert to authenticated with check (true);

create policy "team leaders can rename team" on public.teams
  for update to authenticated
  using (exists (
    select 1 from public.team_memberships
    where team_id = id and user_id = auth.uid() and role = 'leader'
  ));

-- ============================================================
-- 3. Seed: add Jessica to the existing Tim Indo team
-- ============================================================
-- Run after signing in so auth.uid() matches — or do it manually
-- insert into public.team_memberships (user_id, team_id, role)
-- select id, '11111111-1111-1111-1111-111111111111', 'leader'
-- from auth.users where email = 'graspjessica@gmail.com'
-- on conflict do nothing;
