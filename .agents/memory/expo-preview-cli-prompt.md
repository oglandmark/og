---
name: Expo preview CLI prompt
description: A repeated Expo Go account prompt can coexist with a working Replit Expo web preview.
---

Do not assume the mobile preview is unavailable only because the Expo workflow log repeats the Expo Go login prompt. Check the Expo dev domain's `/status` endpoint and capture the mobile artifact preview; Metro may still be serving the app.

For `expo-domain` mobile previews, test the actual Expo dev-domain root. The artifact `previewPath` is not prepended on that destination, so a local test opened at `/mobile/` can misleadingly appear to leave its base path when Expo Router navigates to `/onboarding`.

If the Expo preview shows `Failed to connect to MetaMask` and its stack points to `chrome-extension://`, treat it as an injected browser-extension failure, not an app wallet call. Confirm there are no app-side wallet references before changing code; disable the extension for the preview and reload.

**Why:** In this workspace the workflow showed repeated account prompts, while the Expo domain returned HTTP 200 and the app rendered its startup splash in the browser. A later MetaMask red screen traced to the browser extension; the mobile app source had no MetaMask integration.

**Why:** A local browser test at `/mobile/` navigated to `/onboarding`, but testing the actual Expo domain root showed onboarding rendering and staying stable after the splash; the local path did not reproduce Replit's Expo routing.

**How to apply:** When diagnosing a reload after splash, test the actual Expo dev-domain root and wait past the configured splash duration. Do not infer a route escape from localhost plus the artifact preview path.
