# OG Landmark Laravel API — Hostinger PHP upload

This archive is the backend-only package. It is not meant for the Node.js
framework upload screen. Deploy it as a separate Hostinger PHP application or
subdomain such as `api.oglandmark.com`.

- PHP: 8.2 or newer
- MySQL: 8-compatible Hostinger database
- Document root: `public/`
- `artisan` and `composer.json` stay one level above `public/`
- `vendor/` is included; run Composer only if Hostinger asks for it

## Restore the existing live Hostinger MySQL database

The existing Hostinger MySQL database is the source of truth for live users and
listings. Reuse it; do not create a replacement database, run the repository
snapshot import, or run seed commands against it.

1. Take a verified MySQL backup and a matching backup of the existing uploaded
   media directory before changing the API runtime.
2. Copy `.env.example` to `.env` (or set the equivalent private hPanel
   variables). Set `DB_CONNECTION=mysql` and point `DATABASE_URL` or `DB_URL`
   at the existing Hostinger MySQL database. The Laravel config accepts either
   URL variable; alternatively configure `DB_HOST`, `DB_PORT`, `DB_DATABASE`,
   `DB_USERNAME`, and `DB_PASSWORD`.
3. Keep the existing `APP_KEY`. Set `MEDIA_STORAGE_DIR` to the same persistent
   directory that contains the current listing uploads, and configure the
   existing Hostinger SMTP mailbox values. Never put `.env` under `public/`.
4. In phpMyAdmin, select the existing Hostinger database and import
   `database/hostinger-schema-only.sql`. This optional helper contains only
   `CREATE TABLE IF NOT EXISTS` statements for the Laravel compatibility
   tables. It has no `INSERT`, `UPDATE`, `DELETE`, or `DROP` statements and
   does not replace the existing `app_data` document.
   Existing tables are left unchanged; if an existing table has an unexpected
   structure, stop and inspect it rather than dropping or recreating it.
5. From the Laravel project root, clear stale cached settings and apply the
   Laravel migrations:

   ```sh
   php artisan optimize:clear
   php artisan migrate --force
   php artisan config:cache
   ```

    The migration records the schema in Laravel's migration history and
    creates any missing framework tables. Do **not** add `--seed` and do not
    run `data:import` for this existing database.
6. Verify that `/api/health` reports MySQL connected and that
   `/api/properties` returns the expected live listings. Confirm the health
   response reports persistent media as ready before switching traffic.

## Scheduled announcement delivery

Laravel registers `announcements:process-scheduled` with the scheduler. Add a
Hostinger Cron Job that runs every minute, using the absolute path to this
Laravel application:

```sh
cd /home/USER/domains/DOMAIN/laravel && php artisan schedule:run >> /dev/null 2>&1
```

Confirm `php artisan schedule:list` includes the announcement command. Without
the Hostinger cron job, scheduled announcements remain pending. Test a
controlled announcement with an eligible test account before relying on live
broadcasts. While Laravel is primary, leave the Node application's
`DATABASE_URL` unset; the Node proxy mode skips its legacy database and
scheduler startup.

### Data import

This live-restoration package intentionally omits the repository snapshot.
The phpMyAdmin SQL helper creates schema only and inserts no canonical app
data. Do not run `data:import`, `--seed`, or any snapshot import against the
existing Hostinger database; its current `app_data` row is the production
source of truth. The guarded import tools remain available in the source
repository for a separate, genuinely empty database and a separately reviewed
export.

## Verify

Check these endpoints before setting the website's `LARAVEL_API_URL`:

```text
https://api.yourdomain.com/api/healthz
https://api.yourdomain.com/api/health
```

After MySQL, SMTP, and persistent media storage are working, set the website
environment variable to the API origin:

```text
LARAVEL_API_URL=https://api.yourdomain.com
```