-- Private, one-time account-specific welcome messages managed by Orbit's server-side admin function.
create table if not exists public.orbit_welcome_messages (
  email text primary key check (email = lower(btrim(email)) and length(email) between 3 and 254),
  headline text not null check (length(btrim(headline)) between 1 and 120),
  message text not null default '' check (length(message) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.orbit_welcome_messages enable row level security;
revoke all on table public.orbit_welcome_messages from public, anon, authenticated;
grant all on table public.orbit_welcome_messages to service_role;
comment on table public.orbit_welcome_messages is 'Private one-time welcome messages keyed by normalized account email; only the trusted admin Edge Function can read or write.';

