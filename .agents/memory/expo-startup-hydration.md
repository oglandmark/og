---
name: Expo startup hydration
description: Preventing slow auth and storage hydration from keeping the native Expo splash visible indefinitely.
---

Native startup must not depend indefinitely on the API session check. Restore a cached user identity when available and release the startup loading gate with a bounded watchdog; later token validation can still clear an invalid session.

**Why:** Expo Go preview can reach a slow or unreachable production API while restoring a stale token, leaving the app visually stuck behind its startup splash even though the JavaScript bundle loaded successfully.

**How to apply:** Keep the auth hydration timeout separate from request timeouts, preserve the cached identity only as a temporary rendering fallback, and keep protected API calls responsible for final token enforcement.

## Startup screen

Keep the JavaScript animated splash visible for one complete, non-repeating 8-second HTML cycle after its WebView or iframe reports ready, and until auth and navigation are ready. Hold the final frame if readiness is delayed, and bound onboarding-storage reads so they cannot keep the overlay open indefinitely. On web, fetch the same-origin splash asset once; keep the native launch screen logo-free.

**Why:** The full animation must finish before onboarding or Home appears, but the HTML timeline previously wrapped back to its start while readiness gates were unresolved. A slow or stuck onboarding-storage read could keep the splash visible long enough to replay. On web, downloading the Expo asset before fetching its Metro URL also delayed the animation unnecessarily.

**How to apply:** Start the duration timer from the WebView/iframe ready callback; clamp the HTML timeline at its end; bound auth and onboarding hydration; use a branded fallback if the asset cannot load. Resolve web asset URLs through the active Expo preview origin.

## First-install onboarding

On a fresh install, show three introduction screens—Homes, Commercial, and Agriculture Land—after the complete animated splash. Mark onboarding complete when the user finishes or skips it. On later launches, keep the splash and go directly to Home.

**Why:** The user confirmed this exact first-install-only sequence on October 20, 2026.

**How to apply:** Keep onboarding completion separate from authentication state so logging out does not show the introduction again.