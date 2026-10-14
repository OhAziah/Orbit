# Orbit maintainer guide

## Overview

Orbit is a static web app built with HTML, CSS, and JavaScript. Supabase provides authentication and data storage.

### Deploy with GitHub Pages

In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. GitHub will show the published Pages URL on that screen.

### Connect a Supabase project

1. Create a Supabase project and run `supabase/sql/supabase-schema.sql` in the SQL editor.
2. Set the project URL and **publishable key** in `config.js`.
3. Enable email and password authentication in Supabase Auth.
4. In **Authentication → URL Configuration**, set the Site URL to `https://ohaziah.github.io/Orbit/` and add `https://ohaziah.github.io/Orbit/**` to the allowed Redirect URLs.
5. Publish the repository root with GitHub Pages.

The publishable key is designed for browser use. Never add a Supabase secret or service-role key to this repository. Keep row-level security enabled on the reminders table so each signed-in user can access only their own data.

The site’s code is public when hosted from a public repository. Reminder contents are stored in Supabase and are not committed to GitHub. Email verification and password rules can be configured in Supabase Auth. Supabase’s free tier may pause inactive projects.

### Set up the private admin tools

The `orbit-admin` Edge Function checks the signed-in user against the private administrator registry before returning account information or changing access. It uses a server-side secret and must be deployed with JWT verification enabled; never put that secret in `config.js` or the repository.

For a fresh project, create the first account, run `supabase/sql/supabase-admin-setup.sql`, and deploy `supabase/functions/orbit-admin/index.ts` with JWT verification enabled.

The Admin page can queue a one-time welcome greeting for an email address. Run `supabase/sql/supabase-welcome-setup.sql` before deploying the updated function. The target email and message are stored in a private Supabase table, never in the public frontend. After the recipient signs in, the server removes the queued message and Orbit displays it once.

### Set up push notifications

The live Orbit project has push notifications configured. For a fresh project:

1. Run `supabase/sql/supabase-push-setup.sql` to install the scheduler extensions and create the private push tables.
2. Deploy `supabase/functions/orbit-push/index.ts`. This function validates user sessions for test sends and validates a separate private token for scheduled sends, so it must be deployed with JWT verification disabled.
3. Generate a VAPID key pair, add its public key to `config.js`, then store the project URL, publishable key, public and private VAPID keys, and a random scheduler token in the service-only `orbit_push_config` table. Keep the private VAPID key and scheduler token out of GitHub.
4. Run `supabase/sql/supabase-push-schedule.sql` to check for due reminders every minute.

The push setup uses a one-minute scheduler and the project’s existing Supabase database and Edge Functions. Supabase usage limits still apply.
