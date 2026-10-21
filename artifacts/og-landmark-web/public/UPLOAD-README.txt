OG Landmark — Hostinger upload package
=====================================

Upload ALL files in this folder (or unzip this archive) into the document root
of oglandmark.com (usually public_html/).

Required after extract:
  - index.html          (production shell — NOT index.vite.html)
  - og-api-base.js
  - og-force-db.js
  - .htaccess
  - assets/             (hashed production React bundle)
  - admin/              (React admin SPA at /admin)
  - user/               (React user SPA at /user)
  - portal/             (legacy static portals — optional fallback)

Do NOT upload frontend/dist/ (Vite scaffold). That shows
"Vite + React toolchain restored" instead of the real homepage.

Rebuild this package from the repo root or frontend/:
  npm run build

Output: frontend/build/ and frontend/build.zip
