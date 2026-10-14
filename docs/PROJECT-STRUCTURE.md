# Orbit project structure

Orbit is published by GitHub Pages from the repository root. The root-level web files are intentionally kept in place so existing URLs, browser loading order, the installed web app, and push notifications continue to work.

## Published app files

- `index.html` — page markup and app shell.
- `config.js` — public Supabase client settings and VAPID public key. Never place secret/service-role keys here.
- `auth.js` — sign-in and data-sync integration.
- `app.js` — dashboard and reminder interactions.
- `push-ui.js` — notification controls in the interface.
- `sw.js` — push event and notification-click handling.
- `manifest.webmanifest` — installed-app metadata and scope.
- `orbit-icon.svg` and `orbit-icon-neutral.svg` — icon URLs referenced by the app/manifest/service worker. Keep both root paths available unless all references and cached installations are deliberately migrated.
- `.nojekyll` — preserves GitHub Pages' direct static-file publishing behavior.
- `.gitignore` — excludes local-only files and secrets.

These are not loose files waiting to be moved: their current paths are part of the static deployment. In particular, the service worker's location affects its scope, and the manifest and notification handlers use relative icon URLs.

## Backend and database

- `supabase/functions/orbit-admin/index.ts` — protected administrator actions.
- `supabase/functions/orbit-push/index.ts` — push notification delivery.
- `supabase/sql/` — database schema and setup scripts for the core app, admin tools, welcome messages, and push scheduling.

Supabase Edge Functions are deployed separately from GitHub Pages; moving these files in the repository does not deploy them.

## Documentation

- `README.md` — project overview, getting started, and links to maintainer documentation.
- `docs/MAINTAINERS.md` — deployment, Supabase configuration, Edge Functions, push setup, and security notes.
- `docs/PROJECT-STRUCTURE.md` — this file.

## Safe organisation rule

Before moving any published root file, search all HTML, JavaScript, manifest, service-worker, and documentation references, then update and validate every dependent path together. For changes affecting service-worker location/scope or manifest URLs, test an installed app and push-notification click flow before merging.
