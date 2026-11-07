---
name: Expo startup hydration
description: Preventing slow auth and storage hydration from keeping the native Expo splash visible indefinitely.
---

Native startup must not depend indefinitely on the API session check. Restore a cached user identity when available and release the startup loading gate with a bounded watchdog; later token validation can still clear an invalid session.

**Why:** Expo Go preview can reach a slow or unreachable production API while restoring a stale token, leaving the app visually stuck behind its startup splash even though the JavaScript bundle loaded successfully.

**How to apply:** Keep the auth hydration timeout separate from request timeouts, preserve the cached identity only as a temporary rendering fallback, and keep protected API calls responsible for final token enforcement.

## Startup screen

Keep the JavaScript animated splash visible for one complete, non-repeating 7-second HTML cycle after its WebView or iframe reports ready, and until auth and navigation are ready. Start it as soon as the bundled scene is ready (target 50 ms after app startup) and show no spinner or interim loading UI. Hold the final frame if readiness is delayed, and bound onboarding-storage reads so they cannot keep the overlay open indefinitely. Keep the native launch screen color-only until the animation is ready.

**Why:** The user requested a 7-second animation that begins within 50 ms, with no loading screen before it. The HTML timeline previously wrapped back to its start while readiness gates were unresolved, and the asset-loading fallback exposed a spinner before the animation.

**How to apply:** Preload the HTML as the startup module is evaluated; start the duration timer when the WebView/iframe first frame is ready; clamp the HTML timeline at its end; keep auth and navigation hydration bounded; omit visible loading indicators. Resolve web asset URLs through the active Expo preview origin.

## First-install onboarding

On a fresh install, show three introduction screens—Homes, Commercial, and Agriculture Land—after the complete animated splash. Mark onboarding complete when the user finishes or skips it. On later launches, keep the splash and go directly to Home.

**Why:** The user confirmed this exact first-install-only sequence on October 20, 2026.

**How to apply:** Keep onboarding completion separate from authentication state so logging out does not show the introduction again.