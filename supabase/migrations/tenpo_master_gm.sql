-- Store GM (the store already has an `am` column; this adds the GM contact).
alter table public.tenpo_master
  add column if not exists gm text;
