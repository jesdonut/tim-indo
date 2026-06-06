-- Team Notes: shared real-time notes for all authenticated users
-- Run this in the Supabase SQL editor (supabase.com → your project → SQL Editor)

create table if not exists public.team_notes (
  id          text        primary key default 'main',
  content     text        not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users(id) on delete set null
);

-- Row-level security: any authenticated user can read and write
alter table public.team_notes enable row level security;
grant select, insert, update on public.team_notes to authenticated;

create policy "authenticated users can read notes"
  on public.team_notes for select
  to authenticated
  using (true);

create policy "authenticated users can update notes"
  on public.team_notes for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can insert notes"
  on public.team_notes for insert
  to authenticated
  with check (true);

-- Seed the single shared row so there's always something to upsert into
insert into public.team_notes (id, content) values ('main', '')
  on conflict (id) do nothing;

-- Enable Realtime on this table (required for live sync)
alter publication supabase_realtime add table public.team_notes;
