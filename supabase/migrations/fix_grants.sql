-- Fix: grant table-level privileges to the authenticated role.
-- Newer Supabase projects don't apply these automatically.
-- Run this in Supabase SQL Editor.

grant select, insert, delete on public.team_links to authenticated;
grant select, insert, update on public.team_notes to authenticated;
grant select                  on public.teams      to authenticated;
grant select, insert, update  on public.profiles   to authenticated;
