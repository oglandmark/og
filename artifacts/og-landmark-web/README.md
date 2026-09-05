# OG Landmark Hostinger deployment

This is the supplied website served at `/`, with its API at `/api`. Production storage uses Supabase PostgreSQL.

## Hostinger setup

1. Create or select a Supabase project. In the Supabase SQL Editor, run `database/schema.sql`.
2. Upload and extract the ZIP into the Node.js application's root directory.
3. Select Node.js 18 or newer and run `npm install --omit=dev`.
4. Copy the names from `.env.example` into hPanel's environment-variable settings. Set `SUPABASE_URL` to the project URL and `SUPABASE_SERVICE_ROLE_KEY` to the server-only service-role key. Set `NODE_ENV=production` and keep `APP_URL=https://oglandmark.com`.
5. For a new Supabase project, run `npm run import-data` once. It imports `og-landmark-data.json` into Supabase `app_data`.
6. If the old Hostinger MySQL database already contains live OG Landmark data, temporarily set the old `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` variables alongside the Supabase variables and run `npm run migrate-mysql-data` once. Remove the `MYSQL_*` variables afterward; the running server no longer reads MySQL.
7. Set the startup file to `server.js` and the start command to `npm start`.
8. Point `oglandmark.com` at the Node.js application, enable Hostinger SSL, then restart the application.

Do not create a fixed `PORT` environment variable. Hostinger assigns the application port and the server reads it from `process.env.PORT`; manually forcing `3000` can make the proxy wait on the wrong port.

SMTP values are required for email verification and password reset delivery. In hPanel, first create/verify the sending mailbox, then set `SMTP_USER` to the full mailbox address (for example `support@oglandmark.com`) and `SMTP_PASS` to that mailbox's password—not the hPanel account password. Use `smtp.hostinger.com` with port `465` and `SMTP_SECURE=true`, or port `587` with `SMTP_SECURE=false`. `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_USER`, `MAIL_PASSWORD`, and `MAIL_FROM_ADDRESS` are accepted as aliases. Never upload a populated `.env` file or commit database/SMTP credentials.

After restarting, `/api/health` reports `"smtp": "configured"` when both SMTP username and password are present. The application log will report `SMTP status: connected` or the exact connection failure without printing the password.

The package intentionally does not include a generated lockfile: Replit lockfiles can contain workspace-only package-firewall URLs that are not reachable from Hostinger. `.npmrc` pins installation to the public npm registry.

The Supabase service-role key must remain server-side: never put it in browser code, `public/`, Git, or chat. Do not use the anon key for this backend because the app's private JSON document and session tables have RLS enabled.

After restarting, `/api/health` reports `status: "ok"` and `database: "connected"` when Supabase is reachable. If Supabase settings are missing or unreachable, the HTTP server still opens its assigned port immediately, `/api/health` reports `status: "degraded"` and `database: "not_connected"`, and database-backed API routes return `503` with `DB_NOT_READY`.

`app_data` durably stores listings, users, mobile/developer resources, verification requests, promotions, device tokens, and account-scoped history. `auth_sessions` stores hashed expiring bearer sessions; `auth_challenges` stores hashed password-reset and admin-OTP challenges with attempt limits. Do not commit `.env` or the local fallback file.