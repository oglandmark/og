---
name: Expo startup hydration
description: Preventing slow auth and storage hydration from keeping the native Expo splash visible indefinitely.
---

Native startup must not depend indefinitely on the API session check. Restore a cached user identity when available and release the startup loading gate with a bounded watchdog; later token validation can still clear an invalid session.

**Why:** Expo Go preview can reach a slow or unreachable production API while restoring a stale token, leaving the app visually stuck behind its startup splash even though the JavaScript bundle loaded successfully.

**How to apply:** Keep the auth hydration timeout separate from request timeouts, preserve the cached identity only as a temporary rendering fallback, and keep protected API calls responsible for final token enforcement.

## Startup screen

Keep the JavaScript animated splash visible for one complete 8-second HTML cycle after its WebView or iframe reports ready, and until auth and navigation are ready. Render a branded fallback immediately while the HTML loads; keep the native launch screen logo-free. Load branded fonts in the background with a system-font fallback, and render the animated overlay inside its required providers.

**Why:** The user wants the full animation to finish before onboarding or Home appears. Starting the duration timer at root mount can cut off the animation while the local HTML asset is still loading. In Replit's Expo web preview, Metro assets need the same-origin `/assets/?unstable_path=...` endpoint; a direct `/assets/...` URL can return 404.

**How to apply:** Start the animation timer from the WebView/iframe ready callback, preserve auth and route readiness gates, and use a bounded fallback if the asset cannot load. Resolve web asset URLs through the active Expo preview origin.

## First-install onboarding

On a fresh install, show three introduction screens—Homes, Commercial, and Agriculture Land—after the complete animated splash. Mark onboarding complete when the user finishes or skips it. On later launches, keep the splash and go directly to Home.

**Why:** The user confirmed this exact first-install-only sequence on October 20, 2026.

**How to apply:** Keep onboarding completion separate from authentication state so logging out does not show the introduction again.