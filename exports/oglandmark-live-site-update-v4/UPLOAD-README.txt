OG Landmark — account and data deletion page update (2026-10-08)

This update puts full account deletion and specific data-deletion requests on
one public page. It preserves the existing 14-day completion commitment for
verified requests. It does not include or replace the website, API, database,
uploaded media, or environment settings.

Google Play Console:
  Privacy Policy URL: keep the existing privacy-policy URL.
  Account deletion URL: https://www.oglandmark.com/account-deletion
  Data deletion URL:    https://www.oglandmark.com/account-deletion

Static Hostinger site (public_html):
1. Back up the current .htaccess and pages/ directory.
2. Upload pages/account-deletion.html and pages/data-deletion.html.
   The data-deletion file redirects legacy direct links to account-deletion.
3. Merge the four RewriteRule lines for privacy-policy, privacy,
   account-deletion, and data-deletion from .htaccess into the live
   .htaccess before its SPA fallback. The data-deletion rule must target
   pages/account-deletion.html. Keep unrelated live rewrite rules.

Node site with a public/ directory:
1. Back up public/pages/.
2. Upload public/pages/account-deletion.html and public/pages/data-deletion.html.
   Existing account-deletion routes serve the combined page; the legacy
   data-deletion page redirects browsers to it.
3. Do not replace the Node app, API, database, or environment settings.

After upload, open these links in a private browser window:
  https://www.oglandmark.com/account-deletion
  https://www.oglandmark.com/data-deletion

Both should show the combined account and specific-data request instructions.
The Play Console links above remain unverified until the files are uploaded
and these live checks pass.
