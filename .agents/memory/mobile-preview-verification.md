---
name: Mobile preview verification
description: How to verify mobile inventory changes when the Expo preview screenshot does not reach the relevant screen.
---

Keep the Expo development workflow and Replit mobile preview in sync with mobile code changes. Let Expo hot reload handle ordinary source edits; restart the managed workflow for dependency changes or Metro/runtime issues, and present the updated mobile artifact after meaningful changes.

When a mobile preview screenshot remains on the splash screen or renders blank, do not treat that as confirmation that the content change worked. Inspect the live API response that drives the screen and distinguish API verification from visual verification in the report.

**Why:** the user asked that Expo and Replit preview be updated alongside mobile changes. A prior demo-listing fix passed source-level tests while active sample listings were still present in the preview API; its screenshot captured only the splash.

**How to apply:** Keep the Expo workflow current, verify the live feed after server changes, and present the mobile artifact. If screenshots do not reach Home or Explore, state that visual verification is incomplete.
