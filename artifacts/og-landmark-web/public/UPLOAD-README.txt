OG Landmark — Hostinger frontend update
=======================================

The current website runs as a Node.js app. Back up the live app before updating
its frontend.

1. Copy the contents of frontend/build/ into the existing Node app's public/
   directory. Do not extract the outer archive into public_html/.
2. Keep server.js, package.json, Node app settings, .env values,
   LARAVEL_API_URL, and the Laravel API deployment unchanged.
3. Preserve public/images/uploads and any other persistent media directory.
4. Restart the existing Node.js app after replacing the public files.

Do not replace the frontend with frontend/dist/ (the Vite scaffold); it shows
"Vite + React toolchain restored" instead of the real website.

For a separate static-only hosting setup, the contents of frontend/build/ can
be used as the document root. That is not the current OG Landmark setup.

Rebuild from the repository root or frontend/ with:
  npm run build

Output: frontend/build/ and frontend/build.zip
