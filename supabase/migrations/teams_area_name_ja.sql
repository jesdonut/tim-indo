-- Stores { profile_id: name_ja } mappings for Area staff matching
alter table teams add column if not exists area_name_ja jsonb not null default '{}';
