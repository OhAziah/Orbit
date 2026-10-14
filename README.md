# Orbit

**Your reminders, bills, and everyday plans—in one calm place.**

[Open Orbit](https://ohaziah.github.io/Orbit/)

Orbit is a personal dashboard for the little things you need to remember. Add a reminder, choose a category and due date, and Orbit keeps it organised across your devices when you sign in to the same account.

## What you can do

- **See what’s coming up** in a calendar and daily agenda, including overdue reminders.
- **Organise your reminders** with categories, recurring schedules, notes, search, and filters.
- **Keep bills in view** with monthly totals and paid or unpaid status. Orbit tracks reminders; it doesn’t make payments.
- **Make Orbit yours** with light and dark themes, accent colours, a custom colour, and a dashboard layout you can rearrange.
- **Use it on your phone** with responsive navigation, forms, and calendar views.
- **Get reminders while Orbit is closed** with optional push notifications on devices and browsers that support them.
- **Keep a backup** by exporting your reminders to a JSON file and importing it later.

## Getting started

1. [Open Orbit](https://ohaziah.github.io/Orbit/).
2. Create an account or sign in.
3. Add a reminder with a title, date, and category. For a bill, choose the Money category and add an amount.
4. Sign in to the same account on another device to access your synced reminders.
5. Open **Theme & settings → Notifications** on each device and choose **Enable notifications**. Use **Send test notification** to confirm delivery. A reminder without a time is sent at 9:00 am in that device’s time zone.

On iPhone or iPad, add Orbit to your Home Screen first, then enable notifications from the installed app. Push support on iPhone and iPad requires iOS 16.4 or later.

## Your data and privacy

Your reminders are stored in Orbit’s Supabase database, not in this GitHub repository. Signed-in users can access only their own reminders. Appearance and dashboard layout preferences are saved on the device you’re using.

Push is opt-in and set up separately on each device. Orbit stores the browser’s push subscription and time zone with your account so it can deliver reminders while the app is closed. A notification shows the reminder title on your lock screen; it does not include notes or bill amounts. Turning notifications off removes that device’s subscription. Signing out also turns them off on that device.

Downloaded backups are **unencrypted JSON files** that contain your reminder details. Keep them somewhere private. Orbit is a reminder tool, not a bank or payment service.

## Keyboard shortcuts

- **Ctrl/⌘ + K** — Search reminders
- **N** — Create a reminder
- **Esc** — Close a dialog

---

## For project maintainers

Orbit is a static web app built with HTML, CSS, and JavaScript. Supabase provides authentication and data storage.

### Deploy with GitHub Pages

In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. GitHub will show the published Pages URL on that screen.

### Connect a Supabase project

1. Create a Supabase project and run `supabase-schema.sql` in the SQL editor.
2. Set the project URL and **publishable key** in `config.js`.
3. Enable email and password authentication in Supabase Auth.
4. In **Authentication → URL Configuration**, set the Site URL to `https://ohaziah.github.io/Orbit/` and add `https://ohaziah.github.io/Orbit/**` to the allowed Redirect URLs.
5. Publish the repository root with GitHub Pages.

The publishable key is designed for browser use. Never add a Supabase secret or service-role key to this repository. Keep row-level security enabled on the reminders table so each signed-in user can access only their own data.

The site’s code is public when hosted from a public repository. Reminder contents are stored in Supabase and are not committed to GitHub. Email verification and password rules can be configured in Supabase Auth. Supabase’s free tier may pause inactive projects.

### Set up the private admin tools

The `orbit-admin` Edge Function checks the signed-in user against the private administrator registry before returning account information or changing access. It uses a server-side secret and must be deployed with JWT verification enabled; never put that secret in `config.js` or the repository.

For a fresh project, create the first account, run `supabase-admin-setup.sql`, and deploy `supabase/functions/orbit-admin/index.ts` with JWT verification enabled.

The Admin page can queue a one-time welcome greeting for an email address. Run `supabase-welcome-setup.sql` before deploying the updated function. The target email and message are stored in a private Supabase table, never in the public frontend. After the recipient signs in, the server removes the queued message and Orbit displays it once.

### Set up push notifications

The live Orbit project has push notifications configured. For a fresh project:

1. Run `supabase-push-setup.sql` to install the scheduler extensions and create the private push tables.
2. Deploy `supabase/functions/orbit-push/index.ts`. This function validates user sessions for test sends and validates a separate private token for scheduled sends, so it must be deployed with JWT verification disabled.
3. Generate a VAPID key pair, add its public key to `config.js`, then store the project URL, publishable key, public and private VAPID keys, and a random scheduler token in the service-only `orbit_push_config` table. Keep the private VAPID key and scheduler token out of GitHub.
4. Run `supabase-push-schedule.sql` to check for due reminders every minute.

The push setup uses a one-minute scheduler and the project’s existing Supabase database and Edge Functions. Supabase usage limits still apply.

