-- Optional account-synced Quick Notes storage for Orbit.
-- Review and run manually in the Supabase SQL editor; this is not applied automatically.
create table if not exists public.orbit_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 100),
  content text not null check (char_length(content) between 1 and 5000),
  category text not null default 'Personal' check (category in ('Personal', 'Work', 'Ideas', 'Shopping', 'Home')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orbit_notes_user_updated_idx
  on public.orbit_notes (user_id, updated_at desc);

alter table public.orbit_notes enable row level security;
revoke all on public.orbit_notes from anon;
grant select, insert, update, delete on public.orbit_notes to authenticated;

drop policy if exists "Users can read their own notes" on public.orbit_notes;
create policy "Users can read their own notes"
  on public.orbit_notes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own notes" on public.orbit_notes;
create policy "Users can insert their own notes"
  on public.orbit_notes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own notes" on public.orbit_notes;
create policy "Users can update their own notes"
  on public.orbit_notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own notes" on public.orbit_notes;
create policy "Users can delete their own notes"
  on public.orbit_notes for delete to authenticated
  using ((select auth.uid()) = user_id);
