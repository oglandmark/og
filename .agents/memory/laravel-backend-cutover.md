---
name: Laravel backend cutover
description: Shared Laravel API preserves the existing OG Landmark app_data JSON contract during the Node-to-Laravel transition.
---

The Laravel API should keep the existing `/api/*` response shapes and reuse `app_data`, `auth_sessions`, and `auth_challenges` before any destructive relational rewrite.

**Why:** The website and Expo client already depend on the legacy route names, mixed numeric/string IDs, and the canonical MySQL JSON document. A compatibility cutover lowers production migration risk.

**How to apply:** Keep clients unchanged while verifying Laravel parity. Only switch the public domain after production routing, SMTP, media storage, and endpoint parity are verified.

The public Node website can remain the asset host while an opt-in `LARAVEL_API_URL` proxy forwards its existing `/api/*` origin to Laravel; clearing that variable is the rollback switch.

**Why:** This avoids changing website and Expo route bases during the observation window and keeps a reversible traffic boundary between the two runtimes.

**How to apply:** Verify the Laravel API origin first, set the proxy only after MySQL/SMTP/media smoke checks pass, and do not silently fail over individual requests because split writes would make rollback unsafe.

The Replit website preview should serve the uploaded React build and proxy only `/api/*` to local Laravel; keep the Laravel HTML proxy disabled.

**Why:** The Laravel-rendered homepage displaced the uploaded frontend and changed the design the user asked to preserve.

**How to apply:** Keep webpage and API proxy controls separate. Use the existing static website routes with the local Laravel API, and enable the Laravel HTML proxy only when explicitly requested.

An HTTP 200 from `/api/healthz` is not enough to approve a cutover: compare its readiness fields with the current health contract, then test an OPTIONS preflight from the actual Expo web origin.

**Why:** A reachable Hostinger route can report a disconnected database, serve an older health response shape, and allow the public website through CORS while rejecting the separate Expo preview origin.

**How to apply:** Before production write-flow tests, verify database, media, and SMTP readiness, confirm deployed response parity, and ensure the mobile web origin receives `Access-Control-Allow-Origin`. If health is degraded, limit checks to reads and report the blocker.

In this Laravel runtime, `response()->json(null)` serializes as `{}` rather than JSON `null`; clients may treat that empty object as present content.

**Why:** The website's optional CMS loader treats any truthy payload as synced and displayed a false “Content synced” badge for an empty response.

**How to apply:** For absent optional CMS payloads, return a falsy JSON value or 204 when the client checks payload truthiness; verify the actual serialized response.

The mobile app must call `https://www.oglandmark.com` directly in development and production; do not route mobile API requests through a Replit preview proxy or Replit API server.

**Why:** The user explicitly requested the live website backend instead of Replit's backend.

**How to apply:** Keep the mobile API base fixed to the website domain. Check live health and CORS, and do not run production writes while readiness is degraded.

An endpoint responding on the local Laravel service does not prove that the website's same-origin `/api/*` proxy or the public API domain exposes it; each can route to a different upstream and still return 404.

**Why:** In this workspace, the mobile banners endpoint returned data from the local Laravel listener but 404 through the website preview and canonical API, so the web client had to keep using the bundled mobile fallback.

**How to apply:** Before claiming that a new endpoint drives live web content, test it through the exact browser-facing proxy path and the public API domain as well as the local service. Preserve the client's existing explicit fallback while routing is unresolved.

New Hostinger installs may seed an empty `app_data(id=1)` row, but that seed must be insert-only; importing existing canonical listings and users remains a separate, explicitly verified operation.

**Why:** The canonical document contains the application's listings and account state, so a normal seed must never replace an existing production document.

**How to apply:** Use migrations plus the non-destructive seed for a new database, or import a verified source snapshot separately before switching traffic.

Registration requirements must be enforced across every account-creation path, not only the password-registration endpoint. Provider login and Google ID-token handlers can auto-provision accounts; apply required-profile checks only after existing identities have been matched, so returning social users can still log in. Keep the active Node fallback and standalone Hostinger server copies aligned with Laravel.

**Why:** A register-only phone check is bypassed when a social callback creates a new account directly, especially when a deployment uses the Node fallback instead of Laravel.

**How to apply:** Require mobile for password registration and every provider-driven new-account branch, pass the number from the signup flow, and return a clear mobile-required error for new social users without it. Do not require a returning social user to re-enter their number.