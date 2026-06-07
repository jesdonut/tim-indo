-- Workers table: Indonesian 特定技能 workers managed by the team
-- Sources: grasp-data-main (company) + grasp-data-indonesia (team tracking)

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),

  -- Identity
  worker_id    text,        -- I2, I3 … (team's internal ID)
  employee_no  text,        -- 従業員番号 (company ID)
  name_kana    text,        -- 配属者名 (katakana)
  nickname     text,        -- ニックネーム
  name_latin   text,        -- Latin / romaji name
  gender       text,
  nationality  text,
  birth_date   date,

  -- Contact
  mobile_phone text,
  whatsapp     text,
  email        text,

  -- Assignment
  assignment_month text,    -- 配属月 e.g. 2026-04
  batch_period     text,    -- first_half / second_half
  first_work_date  text,    -- 初出社日
  move_in_date     text,    -- 入居日
  business_unit    text,    -- 組織内業態名称
  division_name    text,    -- 営業部名称
  support_staff    text,    -- サポート担当 (Ben / Dimas / Jessica)

  -- Store / Workplace
  store_code        text,
  store_name        text,
  store_postal_code text,
  store_address     text,
  store_phone       text,

  -- Housing
  housing_postal_code text,
  housing_address     text,
  housing_building    text,  -- 物件名
  housing_room        text,  -- 部屋番号
  housing_passcode    text,  -- パスコード番号
  rent                integer,
  commute_distance    text,
  commute_route_url   text,
  commute_method      text,   -- 通勤方法 e.g. 電車, バス, 徒歩

  -- Arrival
  departure_date    text,    -- 出国日
  japan_arrival_date text,   -- 日本入国日
  arrival_airport   text,
  flight_number     text,
  arrival_time      text,
  arrival_group     text,    -- 入国グループ

  -- Utilities
  electricity_date  text,   -- 電気
  water_date        text,   -- 水道
  gas_appointment   text,   -- ガス立会時間
  gas_deposit       text,   -- ガス保証金
  leopalace_url     text,   -- ライフライン連絡先 (Leopalace guidebook URL)

  -- Payroll
  payroll_pre_id    text,   -- ペイロール入社日前ID (ZTEN… login before joining)
  payroll_post_id   text,   -- ペイロール入社後ID  (009054… after joining)
  payroll_password  text,   -- ペイロールパスワード

  -- Team tracking (editable in app)
  status            text default '順調',
  signal_status     text,   -- Kondisi Sinyal
  mynumber_status   text,   -- マイナンバー
  pledge_done       boolean default false,
  linkus_updated_at date,
  area              text,   -- prefecture in Japanese
  notes             text,

  -- Meta
  team_id    uuid references public.teams(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- worker_id (通し番号 e.g. I1, I2) is the stable unique identity across all CSV sources
-- NULLs are distinct in PostgreSQL so rows without a worker_id yet won't conflict
create unique index if not exists workers_worker_id_team_uniq
  on public.workers(worker_id, team_id);

-- Index for fast search
create index if not exists workers_team_id_idx    on public.workers(team_id);
create index if not exists workers_store_code_idx on public.workers(store_code);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists workers_updated_at on public.workers;
create trigger workers_updated_at
  before update on public.workers
  for each row execute function public.set_updated_at();

-- RLS: team members only
alter table public.workers enable row level security;

drop policy if exists "team members can read workers" on public.workers;
create policy "team members can read workers" on public.workers
  for select using (auth.uid() is not null);

drop policy if exists "team members can insert workers" on public.workers;
create policy "team members can insert workers" on public.workers
  for insert with check (auth.uid() is not null);

drop policy if exists "team members can update workers" on public.workers;
create policy "team members can update workers" on public.workers
  for update using (auth.uid() is not null);

drop policy if exists "team members can delete workers" on public.workers;
create policy "team members can delete workers" on public.workers
  for delete using (auth.uid() is not null);

-- Grant access to authenticated users (required for RLS to work)
grant select, insert, update, delete on public.workers to authenticated;
grant all on public.workers to service_role;
