OG Landmark Hostinger update patch (v2)

Upload/extract the ZIP contents into the active public_html folder and allow the listed files to overwrite existing files. This is an overlay patch; it contains only the public website files listed here and does not contain or replace the API, database, or .env configuration.

This patch:
- Routes /privacy-policy and /account-deletion to standalone pages.
- Fixes the homepage Privacy Policy footer link, which was pointing to #.
- Provides an account-deletion page at both supported web-root layouts.
- Uses a new logo filename so browsers do not keep showing a cached logo.

Files included:
.htaccess
index.html
og-landmark-brand-square-20261002-v2.png
pages/privacy.html
pages/account-deletion.html
public/.htaccess
public/index.html
public/og-landmark-brand-square-20261002-v2.png
public/pages/privacy-policy.html
public/pages/account-deletion.html

After extraction, open these URLs in a private/incognito window:
https://www.oglandmark.com/privacy-policy
https://www.oglandmark.com/account-deletion

Google Play review also checks that the Play Console Data safety and data-deletion answers match the app and every SDK actually used. This website policy cannot replace those Console declarations.