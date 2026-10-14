# Orbit

**Your reminders, bills, and everyday plans—in one place.**

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

## Repository layout

- `index.html`, `config.js`, `auth.js`, `app.js`, and `push-ui.js` are the GitHub Pages frontend entry points and scripts.
- `sw.js`, `manifest.webmanifest`, and the Orbit SVG icons stay at the repository root so the installed app and push notifications keep their existing paths and service-worker scope.
- `supabase/sql/` contains database schema and setup scripts.
- `supabase/functions/` contains the `orbit-admin` and `orbit-push` Edge Functions.

## Project maintainers

Deployment, Supabase setup, Edge Function configuration, push notification setup, and security guidance are documented in [the maintainer guide](docs/MAINTAINERS.md).
