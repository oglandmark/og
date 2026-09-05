# OG Landmark Hostinger deployment

This is the supplied website served at `/`, with its API at `/api`.

## Hostinger setup

1. Create a MariaDB/MySQL database and database user in hPanel.
2. Upload and extract the ZIP into the Node.js application's root directory.
3. Select Node.js 18 or newer and run `npm install --omit=dev`.
4. Copy the names from `.env.example` into hPanel's environment-variable settings. Use the database values issued by Hostinger, set `NODE_ENV=production`, and keep `APP_URL=https://oglandmark.com`.
5. Run `npm run import-data` once. It applies `database/schema.sql` and imports `og-landmark-data.json`.
6. Set the startup file to `server.js` and the start command to `npm start`.
7. Point `oglandmark.com` at the Node.js application, enable Hostinger SSL, then restart the application.

Do not create a fixed `PORT` environment variable. Hostinger assigns the application port and the server reads it from `process.env.PORT`; manually forcing `3000` can make the proxy wait on the wrong port.

SMTP values are required for email verification and password reset delivery. In hPanel, first create/verify the sending mailbox, then set `SMTP_USER` to the full mailbox address (for example `support@oglandmark.com`) and `SMTP_PASS` to that mailbox's password—not the hPanel account password. Use `smtp.hostinger.com` with port `465` and `SMTP_SECURE=true`, or port `587` with `SMTP_SECURE=false`. `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_USER`, `MAIL_PASSWORD`, and `MAIL_FROM_ADDRESS` are accepted as aliases. Never upload a populated `.env` file or commit database/SMTP credentials.

After restarting, `/api/health` reports `"smtp": "configured"` when both SMTP username and password are present. The application log will report `SMTP status: connected` or the exact connection failure without printing the password.

The package intentionally does not include a generated lockfile: Replit lockfiles can contain workspace-only package-firewall URLs that are not reachable from Hostinger. `.npmrc` pins installation to the public npm registry.

If hPanel uses different database variable names, the server also accepts `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, or a MySQL/MariaDB `DATABASE_URL`. The database variables are required; without them Node.js exits during startup and Hostinger returns 503.

Production never uses the local fallback file. If MySQL settings are missing or unreachable, the HTTP server still opens its assigned port immediately, `/api/health` reports `status: "degraded"` and `database: "not_connected"`, and database-backed API routes return `503` with `DB_NOT_READY`. This prevents Hostinger's startup health check from hanging while making the database problem visible in the application log. Once MySQL is reachable, restart the app and `/api/health` should report `status: "ok"` and `database: "connected"`.

`app_data` durably stores listings, users, mobile/developer resources, verification requests, promotions, device tokens, and account-scoped history. `auth_sessions` stores hashed expiring bearer sessions; `auth_challenges` stores hashed password-reset and admin-OTP challenges with attempt limits. Do not commit `.env` or the local fallback file.