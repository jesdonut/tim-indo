-- Extra fields for the full "Move" flow on worker_locations.
-- One active (unarchived) move per worker; archived rows stay as history.
-- All columns nullable. Furigana/担当 are UI-only and intentionally NOT stored here.

alter table public.worker_locations
  -- Old address (move-out side) — snapshotted when a move starts
  add column if not exists housing_postal_code_old   text,
  add column if not exists housing_address_old       text,
  add column if not exists housing_building_old       text,
  add column if not exists housing_room_old           text,

  -- Move logistics
  add column if not exists ido_group                 text,   -- e.g. 関東⑩
  add column if not exists last_work_date            date,   -- 最終出勤日 (old store)
  add column if not exists first_work_date           date,   -- 初出勤日 (new store)

  -- 荷物
  add column if not exists luggage_pickup_datetime   text,
  add column if not exists luggage_delivery_datetime text,
  add column if not exists luggage_received          boolean default false,

  -- 電気
  add column if not exists electricity_stop_date     text,
  add column if not exists electricity_start_date    text,
  add column if not exists electricity_done          boolean default false,

  -- 水道
  add column if not exists water_stop_date           text,
  add column if not exists water_start_date          text,
  add column if not exists water_done                boolean default false,

  -- ガス
  add column if not exists gas_stop_date             text,
  add column if not exists gas_start_date            text,
  add column if not exists gas_tachiai_datetime      text,
  add column if not exists gas_tachiai_unnecessary   boolean default false,
  add column if not exists gas_deposit               integer,
  add column if not exists gas_done                  boolean default false,

  -- 行政
  add column if not exists tenshutsu_date            date,
  add column if not exists tenshutsu_done            boolean default false,
  add column if not exists tennyu_date               date,
  add column if not exists tennyu_done               boolean default false,
  add column if not exists tenkyo_date               date,
  add column if not exists tenkyo_done               boolean default false,

  -- Move state
  add column if not exists is_archived               boolean default false;

create index if not exists worker_locations_active_idx
  on public.worker_locations(worker_id, is_archived);
