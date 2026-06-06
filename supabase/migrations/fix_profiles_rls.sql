-- Fix: allow team members to read each other's profiles (needed for team member list on Profile page)
-- Run this in Supabase SQL Editor if teams_setup.sql was already applied.

drop policy if exists "users can read own profile" on public.profiles;

create policy "team members can read team profiles" on public.profiles
  for select to authenticated using (team_id = public.my_team_id());
