-- tenpo_master is read-only reference data (store lookup by 店舗コード).
-- Logged-in team members can read it; no write access needed from the app.

alter table public.tenpo_master enable row level security;

drop policy if exists "authenticated can read tenpo_master" on public.tenpo_master;
create policy "authenticated can read tenpo_master" on public.tenpo_master
  for select using (auth.uid() is not null);

grant select on public.tenpo_master to authenticated;
grant all on public.tenpo_master to service_role;
