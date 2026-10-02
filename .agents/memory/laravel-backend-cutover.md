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

An HTTP 200 from `/api/healthz` is not enough to approve a cutover: compare its readiness fields with the current health contract, then test an OPTIONS preflight from the actual Expo web origin.

**Why:** A reachable Hostinger route can report a disconnected database, serve an older health response shape, and allow the public website through CORS while rejecting the separate Expo preview origin.

**How to apply:** Before changing `EXPO_PUBLIC_API_URL`, verify database, media, and SMTP readiness, confirm deployed response parity, and ensure the mobile web origin receives `Access-Control-Allow-Origin`.

For the Replit Expo browser preview, route web-only API traffic through the workspace website's opt-in `/api` proxy while native clients keep the canonical API URL. The proxy should answer CORS preflight locally, retain its own CORS headers, and not forward upstream `content-length` or `content-encoding` after Node fetch decompresses the body.

**Why:** The production API allowlist excludes the temporary Expo preview origin, and forwarding the compressed response length after decompression truncates JSON responses, which can break screen loading.

**How to apply:** Enable the development proxy only after API health confirms database, media, and SMTP readiness; keep all operations on the same canonical upstream and test browser preflight plus complete JSON parsing.

An endpoint responding on the local Laravel service does not prove that the website's same-origin `/api/*` proxy or the public API domain exposes it; each can route to a different upstream and still return 404.

**Why:** In this workspace, the mobile banners endpoint returned data from the local Laravel listener but 404 through the website preview and canonical API, so the web client had to keep using the bundled mobile fallback.

**How to apply:** Before claiming that a new endpoint drives live web content, test it through the exact browser-facing proxy path and the public API domain as well as the local service. Preserve the client's existing explicit fallback while routing is unresolved.

New Hostinger installs may seed an empty `app_data(id=1)` row, but that seed must be insert-only; importing existing canonical listings and users remains a separate, explicitly verified operation.

**Why:** The canonical document contains the application's listings and account state, so a normal seed must never replace an existing production document.

**How to apply:** Use migrations plus the non-destructive seed for a new database, or import a verified source snapshot separately before switching traffic.

Registration requirements must be enforced across every account-creation path, not only the password-registration endpoint. Provider login and Google ID-token handlers can auto-provision accounts; apply required-profile checks only after existing identities have been matched, so returning social users can still log in. Keep the active Node fallback and standalone Hostinger server copies aligned with Laravel.

**Why:** A register-only phone check is bypassed when a social callback creates a new account directly, especially when a deployment uses the Node fallback instead of Laravel.

**How to apply:** Require mobile for password registration and every provider-driven new-account branch, pass the number from the signup flow, and return a clear mobile-required error for new social users without it. Do not require a returning social user to re-enter their number.