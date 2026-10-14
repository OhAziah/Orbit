-- Add metadata for safe recurring reminder and bill series.
-- Existing reminders are preserved and remain compatible (new fields default to NULL).
alter table public.reminders add column if not exists series_id uuid;
alter table public.reminders add column if not exists series_start date;
alter table public.reminders add column if not exists series_index integer;
alter table public.reminders drop constraint if exists reminders_series_index_check;
alter table public.reminders add constraint reminders_series_index_check check (series_index is null or series_index >= 0);
create index if not exists reminders_series_idx on public.reminders (user_id, series_id, series_index);
