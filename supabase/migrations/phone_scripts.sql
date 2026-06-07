-- Phone scripts: team-shared, editable call scripts
-- Run in Supabase SQL Editor AFTER teams_setup.sql

create table if not exists public.phone_scripts (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references public.teams(id),
  category   text        not null,
  label      text        not null,
  content    text        not null,
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);

alter table public.phone_scripts enable row level security;
grant select, insert, update, delete on public.phone_scripts to authenticated;

create policy "team members can read scripts"   on public.phone_scripts
  for select to authenticated using (team_id = public.my_team_id());
create policy "team members can insert scripts" on public.phone_scripts
  for insert to authenticated with check (team_id = public.my_team_id());
create policy "team members can update scripts" on public.phone_scripts
  for update to authenticated using (team_id = public.my_team_id());
create policy "team members can delete scripts" on public.phone_scripts
  for delete to authenticated using (team_id = public.my_team_id());

-- Seed: default scripts
insert into public.phone_scripts (team_id, category, label, content, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'ライフライン', 'ガス 開始',  '本人の代理で、ガスの開始をお願いしたいのですが。',    0),
  ('11111111-1111-1111-1111-111111111111', 'ライフライン', 'ガス 停止',  '本人の代理で、ガスの停止をお願いしたいのですが。',    1),
  ('11111111-1111-1111-1111-111111111111', 'ライフライン', '水道 開始', '本人の代理で、水道の開始をお願いしたいのですが。',   2),
  ('11111111-1111-1111-1111-111111111111', 'ライフライン', '水道 停止', '本人の代理で、水道の停止をお願いしたいのですが。',   3),
  ('11111111-1111-1111-1111-111111111111', 'ライフライン', '電気 開始', '本人の代理で、電気の開始をお願いしたいのですが。',   4),
  ('11111111-1111-1111-1111-111111111111', 'ライフライン', '電気 停止', '本人の代理で、電気の停止をお願いしたいのですが。',   5),
  ('11111111-1111-1111-1111-111111111111', 'ライフライン', 'Relation',   'わたしどもは登録支援機関でございまして、生活支援のお手伝いをしております。本人様より委任を受け、代理でご連絡しております。', 6);
