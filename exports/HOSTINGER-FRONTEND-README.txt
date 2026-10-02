OG Landmark — Hostinger frontend-only update

ZIP mein sirf website ka public/ frontend hai. Laravel/API backend, server.js,
package.json, Node dependencies, database files, .env settings, aur secrets
shamil nahi hain.

Install:
1. Hostinger ke existing Node website app mein maujooda public/ folder ka backup
   lein.
2. ZIP ko Node website app ke root mein extract karke public/ files merge ya
   replace karein. ZIP ko public_html mein extract na karein agar website abhi
   Node app se serve hoti hai.
3. Existing server.js, package.json, .env/server settings, Laravel backend, aur
   /api proxy ko bilkul na hatayein. Frontend same-origin /api/* requests use
   karta hai; existing LARAVEL_API_URL proxy setting active rehni chahiye.
4. Hostinger par pehle se maujood public/images/uploads media folder ko
   preserve karein. Uploaded media is ZIP mein shamil nahi hai.
5. Files replace karne ke baad existing Node website app restart karein.

Included frontend: homepage React bundle, CSS/JS assets, logo/favicon, public
images, policy pages, aur buyer/seller/agent/admin portal screens.