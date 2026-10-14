-- Run after orbit-push is deployed and the private config row is populated.
select cron.schedule(
  'orbit-push-reminders',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select supabase_url || '/functions/v1/orbit-push' from public.orbit_push_config where singleton = true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select publishable_key from public.orbit_push_config where singleton = true),
        'x-orbit-cron', (select cron_secret from public.orbit_push_config where singleton = true)
      ),
      body := '{"action":"dispatch"}'::jsonb,
      timeout_milliseconds := 5000
    );
  $job$
);

