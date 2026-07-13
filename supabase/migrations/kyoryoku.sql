-- 協力確認書: 自治体マスタ + 提出記録
-- 提出方法・宛先レベルは自治体ごとにバラバラでルール化できないため、
-- 調査結果を municipalities に蓄積し、そこから PDF 生成とステータス管理を行う。

-- ── enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type submission_method as enum
    ('メール','ホームページフォーム','電子申請システム','郵送','窓口','電話','未調査');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kyoryoku_status as enum
    ('未着手','調査済','提出済','受理確認済');
exception when duplicate_object then null; end $$;

-- ── 自治体マスタ ──────────────────────────────────────────────────────────────
-- name = 宛名に使う正式名（政令市は区単位で1行、市宛なら市で1行、郡名は含めない）
create table if not exists public.municipalities (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  submission_method submission_method not null default '未調査',
  email             text,
  form_url          text,
  department        text,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── 提出記録 ─────────────────────────────────────────────────────────────────
-- store_code は tenpo_master.tenpo_cd と対応するが、CSV 側に誤コードがあるため
-- 外部キーにはしない（FK にすると誤コード行が丸ごと弾かれてしまう）。
create table if not exists public.kyoryoku_submissions (
  id               uuid primary key default gen_random_uuid(),
  store_code       text,
  store_name       text,
  store_address    text,
  municipality_id  uuid references public.municipalities(id) on delete set null,
  status           kyoryoku_status not null default '未着手',
  submitted_at     date,
  receipt_number   text,
  pdf_generated_at timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists kyoryoku_submissions_muni_idx  on public.kyoryoku_submissions(municipality_id);
create index if not exists kyoryoku_submissions_store_idx on public.kyoryoku_submissions(store_code);
create index if not exists kyoryoku_submissions_status_idx on public.kyoryoku_submissions(status);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists municipalities_updated_at on public.municipalities;
create trigger municipalities_updated_at
  before update on public.municipalities
  for each row execute function public.set_updated_at();

drop trigger if exists kyoryoku_submissions_updated_at on public.kyoryoku_submissions;
create trigger kyoryoku_submissions_updated_at
  before update on public.kyoryoku_submissions
  for each row execute function public.set_updated_at();

-- ── RLS: 他テーブルと同じ（ログイン済みなら読み書き可） ────────────────────────
alter table public.municipalities        enable row level security;
alter table public.kyoryoku_submissions  enable row level security;

drop policy if exists "authenticated all municipalities" on public.municipalities;
create policy "authenticated all municipalities" on public.municipalities
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "authenticated all kyoryoku_submissions" on public.kyoryoku_submissions;
create policy "authenticated all kyoryoku_submissions" on public.kyoryoku_submissions
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert, update, delete on public.municipalities       to authenticated;
grant select, insert, update, delete on public.kyoryoku_submissions to authenticated;
grant all on public.municipalities       to service_role;
grant all on public.kyoryoku_submissions to service_role;
