---
name: Expo preview CLI prompt
description: A repeated Expo Go account prompt can coexist with a working Replit Expo web preview.
---

Do not assume the mobile preview is unavailable only because the Expo workflow log repeats the Expo Go login prompt. Check the Expo dev domain's `/status` endpoint and capture the mobile artifact preview; Metro may still be serving the app.

**Why:** In this workspace the workflow showed repeated account prompts, while the Expo domain returned HTTP 200 and the app rendered its startup splash in the browser.

**How to apply:** When asked to show the mobile preview, verify the actual artifact route with a screenshot and present the mobile artifact. The first frame may be the configured startup splash before onboarding or Home appears.
