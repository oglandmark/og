---
name: OG Landmark frontend preservation
description: Defines which supplied compiled website files may change during future backend or admin work.
---

For website work, treat the user's newly supplied ZIP as the source of truth. Change only the logo and Privacy Policy page; keep every other page, asset, layout, and visual exactly as supplied. Implement APIs in Laravel, not in the frontend.

**Why:** The user explicitly requires all website design outside the logo and Privacy Policy page to remain unchanged, with API behavior kept in Laravel.

**How to apply:** Inspect the new ZIP first and use it as the only frontend baseline. Record its asset hashes, make changes only to the logo and Privacy Policy page, and keep API changes in Laravel. Do not carry forward unrelated design edits from the existing website.