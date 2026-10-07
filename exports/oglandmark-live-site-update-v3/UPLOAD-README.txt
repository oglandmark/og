OG Landmark — Play Console legal-page fix (v3)

The Play Console screenshot reports HTTP 404 errors for the privacy policy,
account deletion, and data deletion URLs. This overlay contains only those
standalone pages and route rules. It does not replace the homepage, uploaded
media, Node server, API, database, or environment settings.

Before uploading, back up the current files and .htaccess.

Choose the layout that matches the active Hostinger website:

1. Static website rooted at public_html:
   - Copy .htaccess and pages/ from this folder into the active document root.
   - If a .htaccess already exists, merge the four legal RewriteRule lines
     from this patch into it before any SPA catch-all rule. Do not replace
     unrelated rewrite rules.

2. Hostinger Node website that serves a public/ directory:
   - Copy public/pages/*.html into the existing app public/pages/ directory.
   - Deploy/restart the Node website with the updated server.js from the
     workspace so /data-deletion serves the new page. The existing server
     routes already serve privacy-policy and account-deletion.
   - Preserve the current Node app configuration, uploaded media, API proxy,
     database settings, and environment variables.

After the files are live, open these URLs in a private/incognito browser:
https://www.oglandmark.com/privacy-policy
https://www.oglandmark.com/account-deletion
https://www.oglandmark.com/data-deletion

Each page must load without sign-in and show OG Landmark branding. Then use
those same URLs in the Play Console privacy-policy, account-deletion, and
data-deletion URL fields. Play Console changes are separate from this upload.
