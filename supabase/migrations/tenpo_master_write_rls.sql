-- Allow logged-in team members to add / edit / delete stores in tenpo_master
-- (the store master is shared reference data, no team scoping).
-- Read access is granted separately in tenpo_master_rls.sql.

drop policy if exists "authenticated can insert tenpo_master" on public.tenpo_master;
create policy "authenticated can insert tenpo_master" on public.tenpo_master
  for insert with check (auth.uid() is not null);

drop policy if exists "authenticated can update tenpo_master" on public.tenpo_master;
create policy "authenticated can update tenpo_master" on public.tenpo_master
  for update using (auth.uid() is not null);

drop policy if exists "authenticated can delete tenpo_master" on public.tenpo_master;
create policy "authenticated can delete tenpo_master" on public.tenpo_master
  for delete using (auth.uid() is not null);

grant insert, update, delete on public.tenpo_master to authenticated;
