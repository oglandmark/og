---
name: Mobile preview verification
description: How to verify mobile inventory changes when the Expo preview screenshot does not reach the relevant screen.
---

Keep the Expo development workflow and Replit mobile preview in sync with mobile code changes. In this workspace, launch Metro with `CI` unset: `CI=1` disables reloads and can leave the preview on an old bundle. Restart the managed workflow for dependency changes or Metro/runtime issues, and present the updated mobile artifact after meaningful changes.

Do not infer demo status from a property's title or appearance. Exclude listings only when the data explicitly marks them as demos, while keeping Admin-approved active listings public.

When a mobile preview screenshot remains on the splash screen or renders blank, do not treat that as confirmation that the content change worked. Inspect the live API response that drives the screen and distinguish API verification from visual verification in the report.

**Why:** the user asked that Expo and Replit preview be updated alongside mobile changes. Metro reported reloads disabled in CI mode, and a title-based demo guess hid the user's two active Admin listings, so neither an old bundle nor labels alone are reliable evidence.

**How to apply:** Keep `CI` unset for the managed Expo dev command, verify the live feed after server changes, and present the mobile artifact. If a second Metro process occupies the fixed preview port, check which process owns it and restart the managed workflow so the preview isn't left on a stale bundle. Use explicit demo metadata plus approval/listing status; if screenshots do not reach Home or Explore, state that visual verification is incomplete.

The user confirmed that the installed Android app now displays the Home transaction labels completely as “Buy” and “Rent” after the title-case and wider-toggle fix.

**Why:** The clipping appeared in the Play Store-installed Android app and was not confirmed by the splash-only web preview.

**How to apply:** For future changes to this Home toggle, retain an installed Android visual check; source tests and web previews alone do not prove native rendering.

Expo web previews should load the app's bundled Inter and Playfair fonts too; an empty web font map makes declared font families fall back to browser defaults. First-visit screenshots may also land on onboarding instead of the requested tab.

**Why:** The profile preview looked unstyled until web font loading was enabled, and reaching the requested guest Profile required completing onboarding and selecting its tab.

**How to apply:** Load the same bundled font definitions on web and native. For a visual check, wait through startup, skip onboarding if shown, select Profile, and inspect the actual rendered page rather than relying on a direct URL alone.
