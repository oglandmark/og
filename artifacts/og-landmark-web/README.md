# OG Landmark Hostinger deployment

The public website remains the Node.js application at `/`. The Laravel application
in `../api-server/laravel` is the shared API runtime. During the cutover the Node
process proxies its existing `/api/*` origin to Laravel, so website and Expo
clients do not need a route or token migration.

## Deploy Laravel first

Use a separate Hostinger PHP application or API subdomain such as
`api.oglandmark.com`. Set its document root to `laravel/public`, select PHP 8.2
or newer, and install the committed Composer dependencies:

```sh
cd laravel
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
```

`migrate --force` is non-destructive. The compatibility migration creates
`app_data`, `auth_sessions`, and `auth_challenges` only when they do not already
exist. Do not run a seed command against the live database. Before migration,
take a verified MySQL snapshot and confirm that the target `app_data` row is
the expected production export; the repository fallback JSON is not a
production backup.

Copy `../api-server/laravel/.env.example` to the Laravel application's
server-only environment settings. Set:

- `APP_KEY` to a generated Laravel key, `APP_DEBUG=false`, and
  `APP_URL=https://api.oglandmark.com`.
- `DB_CONNECTION=mysql` and the existing Hostinger `DATABASE_URL`.
- `MAIL_MAILER=smtp`, `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`,
  `SMTP_SECURE=true`, plus the full mailbox values for `SMTP_USER` and
  `SMTP_PASS`. Laravel accepts the existing `SMTP_*` names directly.
- `MEDIA_STORAGE_DIR=public/images/uploads` on a persistent application volume.
  Set `MEDIA_PUBLIC_BASE_URL=https://api.oglandmark.com` when the API is on a
  separate subdomain so mobile and website listings receive public absolute
  media URLs.

Never upload `.env`, commit the MySQL/SMTP values, or place `DATABASE_URL` in a
browser/mobile build.

## Verify the Laravel target before traffic moves

Run these checks against the API origin:

```sh
curl -fsS https://api.oglandmark.com/api/healthz
curl -fsS https://api.oglandmark.com/api/health
```

The response must report `framework: "laravel"`, `status: "ok"`,
`database: "connected"`, `databaseProvider: "mysql"`, and `smtp: "configured"`.
Also verify one public `GET /api/properties` response, a real authenticated
login plus `/api/auth/me`, password-reset mail delivery, and one authenticated
image upload. Confirm the returned media URL loads over HTTPS and survives an
API restart. `healthz` staying available while the database is unavailable is
not a successful cutover; it is only a useful startup diagnostic.

## Switch traffic with rollback

1. Keep the current Node deployment and its MySQL access available. Capture the
   current deployment version and a fresh database/media backup.
2. Deploy Laravel and complete every verification above.
3. On the Node website application, set `LARAVEL_API_URL=https://api.oglandmark.com`
   (no trailing `/api`) and restart it. This opt-in proxy forwards all existing
   `/api/*` requests, including multipart uploads, while the website assets
   continue to be served by Node.
4. Re-run `/api/healthz`, public browsing, login/logout, `/api/auth/me`,
   listing creation/editing, one upload, and the website and Expo smoke flows.
5. Monitor Laravel and Node logs for 4xx/5xx responses and database writes
   during the observation window.

Rollback is deterministic: remove `LARAVEL_API_URL` from the Node environment
and restart the Node application. The proxy is disabled by default, so the
legacy handlers immediately serve `/api/*` again. Keep the Laravel deployment
and database snapshot untouched until the observation window is complete.

## Existing Node website setup

1. Create or retain the Hostinger MySQL database and run `npm run migrate` from
   the Node application root only when the legacy target is empty.
2. Upload the website package, select Node.js 18 or newer, and run
   `npm install --omit=dev`.
3. Copy `.env.example` into hPanel's environment settings. Keep
   `NODE_ENV=production`, `APP_URL=https://oglandmark.com`, and leave
   `LARAVEL_API_URL` empty until the staged switch.
4. For a new empty legacy database, run `npm run import-data` once with a
   verified export. It refuses to overwrite existing data.
5. Set the startup file to `server.js` and start command to `npm start`.
6. Point `oglandmark.com` at the Node.js application and enable Hostinger SSL.

Do not create a fixed `PORT` environment variable. Hostinger assigns the application port and the server reads it from `process.env.PORT`; manually forcing `3000` can make the proxy wait on the wrong port.

SMTP values are required for email verification and password reset delivery. In hPanel, first create/verify the sending mailbox, then set `SMTP_USER` to the full mailbox address (for example `support@oglandmark.com`) and `SMTP_PASS` to that mailbox's password—not the hPanel account password. Use `smtp.hostinger.com` with port `465` and `SMTP_SECURE=true`, or port `587` with `SMTP_SECURE=false`. `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_USER`, `MAIL_PASSWORD`, and `MAIL_FROM_ADDRESS` are accepted as aliases. Never upload a populated `.env` file or commit database/SMTP credentials.

After restarting, `/api/health` reports `"smtp": "configured"` when both SMTP username and password are present. The application log will report `SMTP status: connected` or the exact connection failure without printing the password.

The package intentionally does not include a generated lockfile: Replit lockfiles can contain workspace-only package-firewall URLs that are not reachable from Hostinger. `.npmrc` pins installation to the public npm registry.

The MySQL connection string contains database credentials and must remain server-side: never put it in browser code, `public/`, Git, or chat.

After restarting, `/api/health` reports `status: "ok"`, `database: "connected"`, and `databaseProvider: "mysql"` when MySQL is reachable. If `DATABASE_URL` is missing or MySQL is unreachable, the HTTP server still opens its assigned port immediately, `/api/health` reports `status: "degraded"` and `database: "not_connected"`, and database-backed API routes return `503` with `DB_NOT_READY`.

`app_data` durably stores listings, users, mobile/developer resources, verification requests, promotions, device tokens, and account-scoped history. `auth_sessions` stores hashed expiring bearer sessions; `auth_challenges` stores hashed password-reset and admin-OTP challenges with attempt limits. Do not commit `.env` or the local fallback file.

Uploaded images and videos are stored as files under `MEDIA_STORAGE_DIR`; MySQL stores only their URL/path and metadata in the listing JSON. Upload responses include `path`, `mimeType`, `bytes`, and `kind`. Static video delivery streams files and honors byte ranges. Set `MEDIA_PUBLIC_BASE_URL` only when the same files are mirrored to a CDN/object-storage public endpoint.

`property_search_index` is a rebuildable, non-destructive MySQL projection of `app_data.data.properties`. It supplies indexed filtering, sorting, and bounded pagination for `/api/properties`; the legacy array response remains available. Use `response=page` for `{items,total,offset,limit,hasMore}`.