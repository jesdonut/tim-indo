-- Add pinned flag to team_links
-- Run in Supabase SQL Editor

alter table public.team_links add column if not exists pinned boolean not null default false;
