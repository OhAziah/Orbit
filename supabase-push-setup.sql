-- Orbit web push notifications. Backend configuration is populated separately
-- and must never be committed to the public GitHub repository.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
revoke all on schema net from public, anon, authenticated, service_role;
revoke all on all functions in schema net from public, anon, authenticated, service_role;
revoke all on all tables in schema net from public, anon, authenticated, service_role;
revoke all on all sequences in schema net from public, anon, authenticated, service_role;

create table if not exists public.orbit_push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%'),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orbit_push_subscriptions_user_idx on public.orbit_push_subscriptions(user_id);
alter table public.orbit_push_subscriptions enable row level security;
revoke all on public.orbit_push_subscriptions from public, anon;
grant select, insert, update, delete on public.orbit_push_subscriptions to authenticated;

drop policy if exists "Users can read their own push subscriptions" on public.orbit_push_subscriptions;
create policy "Users can read their own push subscriptions" on public.orbit_push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can add their own push subscriptions" on public.orbit_push_subscriptions;
create policy "Users can add their own push subscriptions" on public.orbit_push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own push subscriptions" on public.orbit_push_subscriptions;
create policy "Users can update their own push subscriptions" on public.orbit_push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own push subscriptions" on public.orbit_push_subscriptions;
create policy "Users can delete their own push subscriptions" on public.orbit_push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.orbit_push_config (
  singleton boolean primary key default true check (singleton),
  supabase_url text not null,
  publishable_key text not null,
  vapid_public_key text not null,
  vapid_private_key text not null,
  cron_secret text not null,
  created_at timestamptz not null default now()
);
alter table public.orbit_push_config enable row level security;
revoke all on public.orbit_push_config from public, anon, authenticated;
grant all on public.orbit_push_config to service_role;

create table if not exists public.orbit_push_deliveries (
  id bigint generated always as identity primary key,
  endpoint text not null references public.orbit_push_subscriptions(endpoint) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  reminder_date date not null,
  target_time text not null,
  sent_at timestamptz not null default now(),
  unique (endpoint, reminder_id, reminder_date, target_time)
);
alter table public.orbit_push_deliveries enable row level security;
revoke all on public.orbit_push_deliveries from public, anon, authenticated;
grant all on public.orbit_push_deliveries to service_role;
grant usage, select on sequence public.orbit_push_deliveries_id_seq to service_role;

-- Keep send metadata private; normal users have no table privilege or RLS path.
comment on table public.orbit_push_config is 'Private Orbit push signing and scheduler configuration. Never expose to browser roles.';
comment on table public.orbit_push_deliveries is 'Private idempotency records for Orbit push delivery.';

