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
- **Keep a backup** by exporting your reminders to a JSON file and importing it later.

## Getting started

1. [Open Orbit](https://ohaziah.github.io/Orbit/).
2. Create an account or sign in.
3. Add a reminder with a title, date, and category. For a bill, choose the Money category and add an amount.
4. Sign in to the same account on another device to access your synced reminders.

## Your data and privacy

Your reminders are stored in Orbit’s Supabase database, not in this GitHub repository. Signed-in users can access only their own reminders. Appearance and dashboard layout preferences are saved on the device you’re using.

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

