---
name: Expo startup hydration
description: Preventing slow auth and storage hydration from keeping the native Expo splash visible indefinitely.
---

Native startup must not depend indefinitely on the API session check. Restore a cached user identity when available and release the startup loading gate with a bounded watchdog; later token validation can still clear an invalid session.

**Why:** Expo Go preview can reach a slow or unreachable production API while restoring a stale token, leaving the app visually stuck behind its startup splash even though the JavaScript bundle loaded successfully.

**How to apply:** Keep the auth hydration timeout separate from request timeouts, preserve the cached identity only as a temporary rendering fallback, and keep protected API calls responsible for final token enforcement.

## Animated startup splash

Do not gate the JavaScript startup splash on bundled-font loading, and keep one splash instance mounted while auth and navigation readiness change. Use a system-font fallback until branded fonts are ready.

**Why:** The native splash is static; waiting for fonts delayed the animated splash by about three seconds, and switching from the loading splash to an overlay remounted the rings.

**How to apply:** Hide the native splash after the first React render, start the animated splash immediately, keep it visible through auth/navigation readiness and the configured minimum duration, then reveal the app. Preserve the minimum duration recorded in the mobile polish guardrails unless the user changes it.