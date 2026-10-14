create table if not exists public.reminders (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  reminder_date date not null,
  reminder_time text,
  category text not null check (category in ('Home','Health','Pets','Money','Personal')),
  repeat_rule text not null default 'none' check (repeat_rule in ('none','weekly','monthly','yearly')),
  notes text not null default '' check (char_length(notes) <= 500),
  done boolean not null default false,
  amount numeric(12,2) check (amount is null or amount >= 0),
  paid boolean not null default false,
  series_id uuid,
  series_start date,
  series_index integer check (series_index is null or series_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_user_date_idx on public.reminders (user_id, reminder_date);
alter table public.reminders enable row level security;
revoke all on public.reminders from anon;
grant select, insert, update, delete on public.reminders to authenticated;

drop policy if exists "Users can read their own reminders" on public.reminders;
create policy "Users can read their own reminders" on public.reminders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their own reminders" on public.reminders;
create policy "Users can insert their own reminders" on public.reminders for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own reminders" on public.reminders;
create policy "Users can update their own reminders" on public.reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own reminders" on public.reminders;
create policy "Users can delete their own reminders" on public.reminders for delete to authenticated using ((select auth.uid()) = user_id);

