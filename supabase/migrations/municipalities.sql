-- Municipalities table for 協力確認書一括作成
create table if not exists public.municipalities (
  id              uuid        primary key default gen_random_uuid(),
  team_id         uuid        not null,
  name            text        not null,
  name_romaji     text,
  email           text,
  submission_method text      check (submission_method in ('email', 'form', 'mail')),
  form_url        text,
  status          text        not null default 'pending'
                              check (status in ('pending', 'sent', 'confirmed')),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.municipalities enable row level security;

create policy "municipalities_team_select" on public.municipalities
  for select using (
    team_id = (select team_id from public.profiles where id = auth.uid())
  );

create policy "municipalities_team_insert" on public.municipalities
  for insert with check (
    team_id = (select team_id from public.profiles where id = auth.uid())
  );

create policy "municipalities_team_update" on public.municipalities
  for update using (
    team_id = (select team_id from public.profiles where id = auth.uid())
  );

create policy "municipalities_team_delete" on public.municipalities
  for delete using (
    team_id = (select team_id from public.profiles where id = auth.uid())
  );
