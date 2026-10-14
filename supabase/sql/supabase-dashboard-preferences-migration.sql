-- Optional cross-device dashboard preference storage for Orbit.
-- Review and run manually in the Supabase SQL editor; this is not applied automatically.
create table if not exists public.orbit_dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.orbit_dashboard_preferences enable row level security;
revoke all on public.orbit_dashboard_preferences from anon;
grant select, insert, update, delete on public.orbit_dashboard_preferences to authenticated;
drop policy if exists "Users can read their own dashboard preferences" on public.orbit_dashboard_preferences;
create policy "Users can read their own dashboard preferences" on public.orbit_dashboard_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their own dashboard preferences" on public.orbit_dashboard_preferences;
create policy "Users can insert their own dashboard preferences" on public.orbit_dashboard_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own dashboard preferences" on public.orbit_dashboard_preferences;
create policy "Users can update their own dashboard preferences" on public.orbit_dashboard_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own dashboard preferences" on public.orbit_dashboard_preferences;
create policy "Users can delete their own dashboard preferences" on public.orbit_dashboard_preferences for delete to authenticated using ((select auth.uid()) = user_id);
