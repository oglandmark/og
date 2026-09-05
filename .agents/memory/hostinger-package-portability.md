---
name: Hostinger package portability
description: Prevents Replit-only dependency metadata from reaching external Node.js hosting.
---

External Hostinger deployment ZIPs must not include Replit-generated npm lockfiles because their resolved URLs can point at the private package-firewall registry.

**Why:** Hostinger cannot resolve `package-firewall.replit.local`, causing dependency installation to fail before the app build starts.

**How to apply:** Ship the standalone package with `.npmrc` set to `https://registry.npmjs.org/`, omit workspace lockfiles, and verify a clean `npm install --omit=dev` plus `/api/health` boot before presenting the ZIP.