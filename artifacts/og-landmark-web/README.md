# OG Landmark Hostinger deployment

This is the supplied website served at `/`, with its API at `/api`. Production storage uses Hostinger MySQL.

## Hostinger setup

1. Create a MySQL database in Hostinger hPanel. Run `npm run migrate` from the application root.
2. Upload and extract the ZIP into the Node.js application's root directory.
3. Select Node.js 18 or newer and run `npm install --omit=dev`.
4. Copy the names from `.env.example` into hPanel's environment-variable settings. Set `DATABASE_URL` to the Hostinger MySQL connection string. Set `NODE_ENV=production` and keep `APP_URL=https://oglandmark.com`.
5. For a new empty database, run `npm run import-data` once. It imports `og-landmark-data.json` into MySQL `app_data` and refuses to overwrite existing data. A verified JSON export can be passed as an argument.
6. Set the startup file to `server.js` and the start command to `npm start`.
7. Point `oglandmark.com` at the Node.js application, enable Hostinger SSL, then restart the application.

Do not create a fixed `PORT` environment variable. Hostinger assigns the application port and the server reads it from `process.env.PORT`; manually forcing `3000` can make the proxy wait on the wrong port.

SMTP values are required for email verification and password reset delivery. In hPanel, first create/verify the sending mailbox, then set `SMTP_USER` to the full mailbox address (for example `support@oglandmark.com`) and `SMTP_PASS` to that mailbox's password—not the hPanel account password. Use `smtp.hostinger.com` with port `465` and `SMTP_SECURE=true`, or port `587` with `SMTP_SECURE=false`. `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_USER`, `MAIL_PASSWORD`, and `MAIL_FROM_ADDRESS` are accepted as aliases. Never upload a populated `.env` file or commit database/SMTP credentials.

After restarting, `/api/health` reports `"smtp": "configured"` when both SMTP username and password are present. The application log will report `SMTP status: connected` or the exact connection failure without printing the password.

The package intentionally does not include a generated lockfile: Replit lockfiles can contain workspace-only package-firewall URLs that are not reachable from Hostinger. `.npmrc` pins installation to the public npm registry.

The MySQL connection string contains database credentials and must remain server-side: never put it in browser code, `public/`, Git, or chat.

After restarting, `/api/health` reports `status: "ok"`, `database: "connected"`, and `databaseProvider: "mysql"` when MySQL is reachable. If `DATABASE_URL` is missing or MySQL is unreachable, the HTTP server still opens its assigned port immediately, `/api/health` reports `status: "degraded"` and `database: "not_connected"`, and database-backed API routes return `503` with `DB_NOT_READY`.

`app_data` durably stores listings, users, mobile/developer resources, verification requests, promotions, device tokens, and account-scoped history. `auth_sessions` stores hashed expiring bearer sessions; `auth_challenges` stores hashed password-reset and admin-OTP challenges with attempt limits. Do not commit `.env` or the local fallback file.

Uploaded images and videos are stored as files under `MEDIA_STORAGE_DIR`; MySQL stores only their URL/path and metadata in the listing JSON. Upload responses include `path`, `mimeType`, `bytes`, and `kind`. Static video delivery streams files and honors byte ranges. Set `MEDIA_PUBLIC_BASE_URL` only when the same files are mirrored to a CDN/object-storage public endpoint.

`property_search_index` is a rebuildable, non-destructive MySQL projection of `app_data.data.properties`. It supplies indexed filtering, sorting, and bounded pagination for `/api/properties`; the legacy array response remains available. Use `response=page` for `{items,total,offset,limit,hasMore}`.