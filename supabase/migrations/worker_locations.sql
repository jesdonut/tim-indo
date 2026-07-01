-- worker_locations: address/store history for workers who move
-- Each row is one "placement" (住所変更 / 店舗変更).
-- move_number 1 = first placement, 2 = second move, etc.

create table if not exists public.worker_locations (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  move_number integer not null default 1,

  -- Housing
  housing_address     text,
  housing_postal_code text,
  housing_building    text,
  housing_room        text,
  housing_passcode    text,
  rent                integer,
  move_in_date        date,
  move_out_date       date,

  -- Store / Workplace
  store_code          text,
  store_name          text,
  store_address       text,
  store_postal_code   text,
  store_phone         text,
  commute_method      text,
  commute_distance    text,
  commute_route_url   text,

  -- Contact snapshot (phone can change between moves)
  mobile_phone        text,

  -- Utilities at this location
  electricity_date    text,
  water_date          text,
  gas_appointment     text,
  leopalace_url       text,

  notes               text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(worker_id, move_number)
);

create index if not exists worker_locations_worker_id_idx on public.worker_locations(worker_id);
create index if not exists worker_locations_team_id_idx   on public.worker_locations(team_id);

-- Auto-update updated_at
drop trigger if exists worker_locations_updated_at on public.worker_locations;
create trigger worker_locations_updated_at
  before update on public.worker_locations
  for each row execute function public.set_updated_at();

-- RLS: same as workers table
alter table public.worker_locations enable row level security;

drop policy if exists "team members can read worker_locations" on public.worker_locations;
create policy "team members can read worker_locations" on public.worker_locations
  for select using (auth.uid() is not null);

drop policy if exists "team members can insert worker_locations" on public.worker_locations;
create policy "team members can insert worker_locations" on public.worker_locations
  for insert with check (auth.uid() is not null);

drop policy if exists "team members can update worker_locations" on public.worker_locations;
create policy "team members can update worker_locations" on public.worker_locations
  for update using (auth.uid() is not null);

drop policy if exists "team members can delete worker_locations" on public.worker_locations;
create policy "team members can delete worker_locations" on public.worker_locations
  for delete using (auth.uid() is not null);

grant select, insert, update, delete on public.worker_locations to authenticated;
grant all on public.worker_locations to service_role;
