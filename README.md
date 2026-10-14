# Orbit

Orbit is a calm, modern home for your reminders, routines, and bills. See what’s coming up, organise tasks by category, and keep monthly costs in view—all in one simple dashboard that syncs across your devices.

A personal reminders and bills dashboard that syncs across devices through Supabase Auth and Postgres.

## Features

- Calendar, today, upcoming, and overdue reminders
- Recurring reminders and categories
- Search and category/status filters
- Monthly bills total and paid/unpaid tracking
- Light, dark, and device-matched themes with ten accent colours
- Private JSON backup export and reminder import
- Keyboard shortcuts for search and quick add
- Responsive layout with phone-friendly navigation, dialogs, and forms

## Connect Supabase

1. Create a Supabase project and run `supabase-schema.sql` in the SQL editor (or apply it as a migration).
2. Copy the project URL and publishable key into `config.js`.
3. Enable email/password authentication in Supabase Auth.
4. In **Authentication → URL Configuration**, set the Site URL to `https://ohaziah.github.io/Orbit/` and add `https://ohaziah.github.io/Orbit/**` to the allowed Redirect URLs so email confirmation returns to the app.
5. Publish the root folder with GitHub Pages.

The publishable key is intended for browser use. Never put a Supabase secret or service-role key in this repository. The reminders table has row-level security enabled and each signed-in user can access only their own rows. Do not disable those policies.

The website and source are public when hosted on GitHub Pages from a public repository. Reminder contents are stored in Supabase, not committed to this repository. Email verification and password policies can be configured in Supabase Auth. The free Supabase tier may pause inactive projects.

Appearance preferences are saved on the current device. Backups are unencrypted JSON files containing reminder details; store them somewhere private.

## Publish with GitHub Pages

In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. The static site will be available at the Pages URL shown on that screen.

