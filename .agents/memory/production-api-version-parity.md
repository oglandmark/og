---
name: Production API version parity
description: Diagnose when Replit preview and Hostinger production expose different API behavior.
---

Treat Replit preview and Hostinger production as separate API runtimes. A preview health check can reflect the local Laravel API while the public website uses the Hostinger API. A production health check showing SMTP configured does not prove that a specific route is deployed or that email delivery succeeds.

The public website domain `oglandmark.com` serves the website HTML for `/api/*`; the live Laravel JSON API is on `api.oglandmark.com`. On 2026-11-04, health and property routes returned JSON from the API subdomain while `/api/mobile/settings` and `/api/projects` returned 404.

**Why:** Admin password-reset tests passed against the current Laravel source, while `api.oglandmark.com` still returned 404 for the new reset route. Re-saving Replit Secrets and restarting the local API could not update Hostinger's deployed code.

**How to apply:** Use `https://api.oglandmark.com` for live Laravel calls, and `https://www.oglandmark.com` for public website/media URLs. Check the exact API endpoint against both local preview and production. Use a non-existent email for route smoke tests to avoid sending mail. Keep preview traffic local unless the user authorizes connecting broader preview behavior to live data, and package Hostinger code updates separately from Replit Secrets.
