# OG Landmark Hostinger deployment

This is the supplied website served at `/`, with its API at `/api`.

## Hostinger setup

1. Create a MariaDB/MySQL database and database user in hPanel.
2. Upload and extract the ZIP into the Node.js application's root directory.
3. Select Node.js 20 or newer and run `npm install --omit=dev`.
4. Copy the names from `.env.example` into hPanel's environment-variable settings. Use the database values issued by Hostinger, set `NODE_ENV=production`, and keep `APP_URL=https://oglandmark.com`.
5. Run `npm run import-data` once. It applies `database/schema.sql` and imports `og-landmark-data.json`.
6. Set the startup file to `server.js` and the start command to `npm start`.
7. Point `oglandmark.com` at the Node.js application, enable Hostinger SSL, then restart the application.

SMTP values are required for email verification and password reset delivery. Never upload a populated `.env` file or commit database/SMTP credentials.

Production refuses to start without MySQL. A `runtime-data.json` fallback is used only for local/Replit preview when MySQL settings are absent. `app_data` durably stores listings, users, mobile/developer resources, verification requests, promotions, device tokens, and account-scoped history. `auth_sessions` stores hashed expiring bearer sessions; `auth_challenges` stores hashed password-reset and admin-OTP challenges with attempt limits. Do not commit `.env` or the local fallback file.