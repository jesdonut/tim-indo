-- Per-worker clothing sizes (from the CSV columns ユニフォームサイズ / 靴).
alter table public.workers
  add column if not exists uniform_size text,
  add column if not exists shoe_size    text;
