-- Team Links: shared bookmarks for all authenticated users
-- Run this in the Supabase SQL editor

create table if not exists public.team_links (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  url        text        not null,
  category   text        not null default '',
  added_by   text,
  created_at timestamptz not null default now()
);

alter table public.team_links enable row level security;
grant select, insert, delete on public.team_links to authenticated;

create policy "authenticated users can read links"
  on public.team_links for select to authenticated using (true);

create policy "authenticated users can insert links"
  on public.team_links for insert to authenticated with check (true);

create policy "authenticated users can delete links"
  on public.team_links for delete to authenticated using (true);

alter publication supabase_realtime add table public.team_links;

-- Seed: initial links added by Jessica
insert into public.team_links (title, url, category, added_by) values
  -- グラスプ
  ('インドネシアチームのGoogle Drive', 'https://drive.google.com/drive/folders/1wLAplzgP5gUYzCJBuxbA7rlLGUjXQ-y2?usp=sharing', 'グラスプ', 'Jessica'),
  ('定例会', 'https://docs.google.com/spreadsheets/d/1TYwa-E6-lvf0rI7v0GLRp0OHgQHgf4YK/edit?gid=659850896#gid=659850896', 'グラスプ', 'Jessica'),
  ('サポートＭＴＧ', 'https://docs.google.com/spreadsheets/d/1EqE2tXjDl05Xd9Ym1CewARHbnuwFBOphdFM3tsl-gOk/edit?gid=306902511#gid=306902511', 'グラスプ', 'Jessica'),
  ('インドネシア入国者＿初出勤の感想', 'https://docs.google.com/forms/d/1FxRCfjE8XG0FqtEi_278wzu3byd-77esUbhrnHHrELY/edit', 'グラスプ', 'Jessica'),
  ('店舗異動案件', 'https://docs.google.com/spreadsheets/d/10NuVi5GYoea0GlUmgcR9ZsosACzly_tu/edit?gid=863640436#gid=863640436', 'グラスプ', 'Jessica'),
  -- データ
  ('インドネシア・ミャンマー連携データ', 'https://docs.google.com/spreadsheets/d/1emYVFaIQ-KDY7RxiiPagVmVNtejSkA4t/edit?gid=690526909#gid=690526909', 'データ', 'Jessica'),
  ('【1月15日-26日配属店舗】店舗配属確認表', 'https://docs.google.com/spreadsheets/d/1N5LeYUJWWhm6Am2w9Kg1CXu5OkOtxwY0/edit?gid=901695543#gid=901695543', 'データ', 'Jessica'),
  ('【1月29日-30日配属店舗】店舗配属確認表', 'https://docs.google.com/spreadsheets/d/1BNIFHIZh1twOUQ51t5MhjS0WZi-PmTdP/edit?gid=26396926#gid=26396926', 'データ', 'Jessica'),
  ('【2月配属店舗】店舗配属確認表', 'https://docs.google.com/spreadsheets/d/1HQO47K-q2dlkApoxM3Xmz2aZNBj-gCy9/edit?gid=1460569772#gid=1460569772', 'データ', 'Jessica'),
  ('【3月配属店舗】送り込みスケジュール', 'https://docs.google.com/spreadsheets/d/1kLk1GiPAeqyyxRqsEslffOcXKEW14n0M/edit?gid=82061368#gid=82061368', 'データ', 'Jessica'),
  ('【3月店舗移動】', 'https://docs.google.com/spreadsheets/d/1ar9q4Lx4rvfZjqE3u1_OQiNy8_3yzEW7/edit?gid=983979864#gid=983979864', 'データ', 'Jessica'),
  ('【4月前半配属店舗】送り込みスケジュール', 'https://docs.google.com/spreadsheets/d/1pXaUnokGN7g3J0nSlXWbQvRyZ9ITP3It/edit?gid=1360324590#gid=1360324590', 'データ', 'Jessica'),
  ('【4月後半配属店舗】送り込みスケジュール', 'https://docs.google.com/spreadsheets/d/11yrj2_l2yKUTImuDvMVvCXl7GWH4xm9F/edit?gid=554231161#gid=554231161', 'データ', 'Jessica'),
  ('【4月後半配属店舗】店舗配属', 'https://docs.google.com/spreadsheets/d/1EFphFndxGo7lSKewOJ0RMkwm9N48Jdea/edit?gid=1463768639#gid=1463768639', 'データ', 'Jessica'),
  ('1月15日～26日 全体送り込みtodo', 'https://docs.google.com/spreadsheets/d/17hwPvEXVOEzWxfI8vb9rDdzuqf5WisjJ/edit?gid=1150064807#gid=1150064807', 'データ', 'Jessica'),
  ('1月29日・30日 全体送り込みtodo', 'https://docs.google.com/spreadsheets/d/1XplMmIZgaLR0uHVzgqdTRKYaZOwB36x-/edit?gid=1150064807#gid=1150064807', 'データ', 'Jessica'),
  ('2月 全体送り込みtodo', 'https://docs.google.com/spreadsheets/d/1y8Eu-7f0tDhYtwprs5qSK01ovUFglStn/edit?gid=2084531507#gid=2084531507', 'データ', 'Jessica'),
  ('3月 全体送り込みtodo', 'https://docs.google.com/spreadsheets/d/1dyaPNB0L3CEBsfK8hmuMi95tu_lpVBld/edit?gid=2084531507#gid=2084531507', 'データ', 'Jessica'),
  ('【インドネシアver】1月入国todoリスト', 'https://docs.google.com/spreadsheets/d/1M27MxrjSZ2Hdxj0f6AZF9nPbrk08BxA7/edit?gid=934385539#gid=934385539', 'データ', 'Jessica'),
  ('【インドネシアver】2月入国todoリスト', 'https://docs.google.com/spreadsheets/d/1p9WMHydi7xqoq3WPNi-lpMR10sBMWgWO/edit?gid=934385539#gid=934385539', 'データ', 'Jessica'),
  ('【インドネシアver】3月入国todoリスト', 'https://docs.google.com/spreadsheets/d/195BRJIV17CYTKCBOWKHX7mxG7Z4l2pLy/edit?gid=1815619790#gid=1815619790', 'データ', 'Jessica'),
  ('【インドネシア】4月入国前半todoリスト', 'https://docs.google.com/spreadsheets/d/1hFApUMs7A1P-kPHqHocEOXk5s6nXBZAT/edit?usp=sharing&ouid=112180163009175724999&rtpof=true&sd=true', 'データ', 'Jessica'),
  ('【インドネシア】4月入国後半todoリスト', 'https://docs.google.com/spreadsheets/d/1bXBu48Vpxhj63V6Q09ZKHkwTno5ZMuav/edit?rtpof=true&sd=true', 'データ', 'Jessica'),
  -- コンパス社
  ('Daftar akun P3 pertama kali', 'https://p3.payroll.co.jp/freechoice/web/entry.html', 'コンパス社', 'Jessica'),
  ('Payroll P3 / Nyuusha kit 入社前', 'https://p3.payroll.co.jp/redirect/epay/webkit?a=EMP%2FCEPAY0328%2F00001', 'コンパス社', 'Jessica'),
  ('Payroll P3 / Nyuusha kit 入社後', 'https://p3.payroll.co.jp/1.0/openidprovider/cgj/login?response_type=code&client_id=323455396026-xr5w76uuareywhh6cs4finaeuitzszfm.apps.payroll.co.jp&redirect_uri=https%3A%2F%2Fp3.payroll.co.jp%2Fepay%2Fauth%2Fopenid-cb&scope=openid%20payroll&prompt=login&saml=0', 'コンパス社', 'Jessica'),
  -- ライフライン
  ('ガス: Astomos Energy', 'https://my-astomosretailing.com/', 'ライフライン', 'Jessica');
