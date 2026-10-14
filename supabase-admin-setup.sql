-- Run after at least one account exists. On a single-owner project, the
-- only existing account is registered as its administrator. This inserts
-- nobody when the project already has more than one account.
create table if not exists public.orbit_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.orbit_admins enable row level security;
revoke all on table public.orbit_admins from public, anon, authenticated;
grant all on table public.orbit_admins to service_role;
insert into public.orbit_admins (user_id)
select id from auth.users
where (select count(*) from auth.users) = 1
on conflict (user_id) do nothing;

-- App-level suspension blocks existing sessions from reading or changing
-- reminders, as well as preventing future logins through Supabase Auth.
create table if not exists public.orbit_blocked_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now()
);
alter table public.orbit_blocked_users enable row level security;
revoke all on table public.orbit_blocked_users from public, anon, authenticated;
grant select on table public.orbit_blocked_users to authenticated;
grant all on table public.orbit_blocked_users to service_role;
drop policy if exists "Users can view their own access status" on public.orbit_blocked_users;
create policy "Users can view their own access status"
  on public.orbit_blocked_users for select to authenticated
  using ((select auth.uid()) = user_id);

-- Preserve ownership checks and additionally deny reminder access to a
-- suspended user, including any still-valid access token they already hold.
drop policy if exists "Users can read their own reminders" on public.reminders;
create policy "Users can read their own reminders" on public.reminders for select to authenticated
  using ((select auth.uid()) = user_id and not exists (
    select 1 from public.orbit_blocked_users b where b.user_id = (select auth.uid())
  ));
drop policy if exists "Users can insert their own reminders" on public.reminders;
create policy "Users can insert their own reminders" on public.reminders for insert to authenticated
  with check ((select auth.uid()) = user_id and not exists (
    select 1 from public.orbit_blocked_users b where b.user_id = (select auth.uid())
  ));
drop policy if exists "Users can update their own reminders" on public.reminders;
create policy "Users can update their own reminders" on public.reminders for update to authenticated
  using ((select auth.uid()) = user_id and not exists (
    select 1 from public.orbit_blocked_users b where b.user_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = user_id and not exists (
    select 1 from public.orbit_blocked_users b where b.user_id = (select auth.uid())
  ));
drop policy if exists "Users can delete their own reminders" on public.reminders;
create policy "Users can delete their own reminders" on public.reminders for delete to authenticated
  using ((select auth.uid()) = user_id and not exists (
    select 1 from public.orbit_blocked_users b where b.user_id = (select auth.uid())
  ));

