# Admin password-reset API update

The current Laravel source supports `POST /api/auth/admin-forgot-password` and
`POST /api/auth/admin-reset-password`. The live API returned `404 Not found` for
the first route, which means its deployed controller is older than this source.

## Updating the existing Hostinger API

1. Back up the current API files and the existing MySQL database.
2. Upload this backend package over the existing Laravel application. Preserve
   the existing `.env`, `APP_KEY`, database, `storage` files, and uploaded media.
3. Do not import data, seed the database, run `data:normalize-core`, or change
   the production database for this controller update.
4. Restart the PHP application or clear its OPcache so the new controller is
   loaded.
5. Confirm that a POST to
   `https://api.oglandmark.com/api/auth/admin-forgot-password` no longer returns
   `404`. A request for an address that is not an admin account should return a
   generic success response and should not send an email.
6. Then use the admin login page with the live administrator email to verify
   delivery. Do not share the reset code with anyone.

This package excludes `.env`, live data, logs, cached settings, and uploaded
media. Keep the current SMTP mailbox settings in Hostinger; this update adds
the missing API route and does not change mail credentials.
