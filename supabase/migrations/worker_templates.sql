create table if not exists worker_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  name text not null,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, name)
);

alter table worker_templates enable row level security;

-- Team members can read, insert, update, delete templates for their own team
create policy "team members full access"
  on worker_templates
  for all
  using (team_id = (auth.jwt() -> 'user_metadata' ->> 'team_id')::uuid)
  with check (team_id = (auth.jwt() -> 'user_metadata' ->> 'team_id')::uuid);
