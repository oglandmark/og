---
name: Expo startup hydration
description: Preventing slow auth and storage hydration from keeping the native Expo splash visible indefinitely.
---

Native startup must not depend indefinitely on the API session check. Restore a cached user identity when available and release the startup loading gate with a bounded watchdog; later token validation can still clear an invalid session.

**Why:** Expo Go preview can reach a slow or unreachable production API while restoring a stale token, leaving the app visually stuck behind its startup splash even though the JavaScript bundle loaded successfully.

**How to apply:** Keep the auth hydration timeout separate from request timeouts, preserve the cached identity only as a temporary rendering fallback, and keep protected API calls responsible for final token enforcement.

## Startup screen

Keep the JavaScript animated splash visible for at least 7 seconds and until auth and navigation are ready, but keep the native Android launch screen to a neutral background without its own static logo image. Load branded fonts in the background with a system-font fallback, and render the animated overlay inside its required providers.

**Why:** On October 20, 2026, the user clarified that the 7-second animated splash should remain while the separate logo-only native opening screen should be removed.

**How to apply:** Keep Expo's splash-screen plugin for a plain background without an image, hide the native screen after the first React render, and reveal the app only after the animation duration, auth hydration, and route readiness are all satisfied.

## First-install onboarding

On a fresh install, show three introduction screens—Homes, Commercial, and Agriculture Land—after the 7-second animated splash. Mark onboarding complete when the user finishes or skips it. On later launches, keep the splash and go directly to Home.

**Why:** The user confirmed this exact first-install-only sequence on October 20, 2026.

**How to apply:** Keep onboarding completion separate from authentication state so logging out does not show the introduction again.