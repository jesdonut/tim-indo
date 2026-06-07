-- Moodboard ordering: lets cards be dragged into any arrangement.
-- sort_order is nullable; rows without it fall back to created_at order.
alter table team_links add column if not exists sort_order int;
