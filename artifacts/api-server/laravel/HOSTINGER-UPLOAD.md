# OG Landmark Laravel API — Hostinger PHP upload

This archive is the backend-only package. It is not meant for the Node.js
framework upload screen. Deploy it as a separate Hostinger PHP application or
subdomain such as `api.oglandmark.com`.

- PHP: 8.2 or newer
- MySQL: 8-compatible Hostinger database
- Document root: `public/`
- `artisan` and `composer.json` stay one level above `public/`
- `vendor/` is included; run Composer only if Hostinger asks for it

## Database setup

Create an empty MySQL database and database user in Hostinger. Copy
`.env.example` to `.env` and configure `APP_KEY`, `DB_HOST`, `DB_PORT`,
`DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, SMTP values, and a persistent
`MEDIA_STORAGE_DIR`. Never upload a populated `.env` to a public directory.

Use **one** of these database setup methods:

### Recommended: Artisan migrations

From the Laravel project root, run once:

```sh
php artisan key:generate --force
php artisan migrate --seed --force
php artisan optimize:clear
php artisan config:cache
```

The seeder creates only an empty canonical `app_data` document. It does not
create a fake admin account and it never overwrites an existing `app_data` row.

### Alternative: phpMyAdmin import

If SSH/Terminal is unavailable, import `database/mysql-schema.sql` into the
empty Hostinger MySQL database using phpMyAdmin. Do not run both methods on a
new database.

The SQL file creates Laravel's users, sessions, cache, queue, migration,
`app_data`, `auth_sessions`, and `auth_challenges` tables. It contains no
passwords, API keys, mail credentials, or production listing data.

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