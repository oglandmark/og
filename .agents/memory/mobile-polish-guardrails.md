---
name: Mobile polish guardrails
description: Durable UI rules for extending the OG Landmark Expo app without changing its product identity or creating invalid web markup.
---

Use the shared semantic tokens and reusable controls for new mobile UI. The current palette is Midnight Navy (#0B1F3A), Infinity Teal (#19C3B1), Landmark Gold (#F2B84B), and Pure White (#FFFFFF); use teal as a restrained accent while navy remains the main action color. Use the roof + OG mark with teal-to-gold color, and keep the former three-pillar mark out of the product. The Home header must show the full “OG Landmark” wordmark beside the mark; keep app icons symbol-only and use symbol-only marks in other compact headers unless requested otherwise. Keep the animated app-opening splash visible for at least 7 seconds; do not restore a separate static logo-only native splash image. Use the colored mark on navy surfaces when legible and a high-contrast inverse on light/dark surfaces as needed. Interactive property cards must keep their image, favorite, share, and media controls outside the body detail press target; do not nest pressable controls inside another pressable.

For property-listing selection UI, use premium flat 2D Feather line icons rather than emoji glyphs, with restrained navy/gold treatments.

Render the branded native `RefreshControl` only on iOS and Android; omit it on web.

**Why:** In the Replit Expo browser preview, passing the native refresh control to Home's `ScrollView` left the Home screen blank while its tab bar remained visible. Guarding the prop on web restored Home and the onboarding-to-Home flow.

**How to apply:** For shared list screens, keep pull-to-refresh on native platforms and set the `ScrollView` refresh control to `undefined` on web.

Preserve existing bottom-tab destinations, order, and behavior during Profile redesigns; restyle the bar when explicitly requested.

**Why:** The user asked to retain the current navigation while updating the Profile screen.

**How to apply:** Update Profile content without rebuilding or rearranging the tabs; apply only requested visual changes to the shared bar.

Guest Profile keeps six locked activity shortcuts and the five public Settings links inline on the same page.

**Why:** The user supplied the desired Profile layout and clarified those options should remain on the page.

**How to apply:** Keep Saved Properties, Saved Searches, Search Alerts, Scheduled Visits, My Inquiries, and Recently Viewed in Your Activity; preserve Language, Help & Support, About, Privacy & Security, and Terms & Privacy below Settings.

**Why:** The user asked to polish property listing and use premium 2D icons.

**How to apply:** Keep iconography consistent across property-type categories, selection tiles, and listing progress, and use semantic colors instead of one-off hardcoded palettes.

**Why:** The user confirmed the roof/house + OG artwork as the official mark and, on November 5, 2026, supplied the current mobile palette and requested a teal accent, updated logo, and animated splash. The three-pillar mark must remain removed throughout the app. The Expo Go loading view's label is the configured project name, not the in-app splash; changing it also changes the installed app's display name. The app is also rendered on web through React Native Web, where nested pressables become nested HTML buttons and produce hydration/runtime errors. Central tokens keep the visual language consistent across the many legacy screens.

**How to apply:** Extend `PolishedUI` and the semantic color/layout tokens before adding one-off controls. Use the official roof/house + OG mark in #0B1F3A on light surfaces and its white inverse on dark surfaces. Keep the three-pillar artwork out of active app, web, portal, legal-page, and icon assets. For cards, make the body the detail target and leave media/action controls as sibling press targets. Respect reduced-motion settings in shared animations, except the official logo mark, which the user explicitly wants animated on iOS even when Reduce Motion is enabled; keep that override local to the logo.

The user-provided navy rounded-square logo with a gold roof and turquoise-to-gold OG monogram is the official website logo. Use this master mark consistently in public pages, account portals, admin areas, and browser icons; do not substitute older logo variants.

**Why:** The user identified this specific image as the official logo on November 6, 2026.

**How to apply:** When updating website branding, use the supplied master mark as-is and preserve its square silhouette. Keep unrelated website assets and page layouts unchanged.

**Why:** The user requested a looping animation on the OG-and-roof mark in the mobile app, starting ten seconds after each page opens.

**How to apply:** Keep this motion on the shared logo mark, restart its delay when a page gains focus, stop it when focus leaves, and leave the separate wordmark unanimated. Nested tab headers should receive the parent screen's focus state explicitly; enable the web animation opt-in where the Replit preview should show it.

**Why:** The Profile header's nested logo stayed static when its own focus hook did not start reliably, and web animation is opt-in for the shared mark.

Native status-bar icons do not support an arbitrary brand tint on iOS or Android; use the OS dark-content mode on a light status-bar area, and preserve intentional hiding in immersive full-screen media.

**Why:** The user requested navy system icons, but native status-bar APIs expose dark/light treatments rather than an exact custom icon color. Dark icons need a light area behind them to remain legible.

**How to apply:** Set the shared Expo status bar to dark content and Android's native status-bar style to `dark-content`. Do not draw substitute battery, signal, or time icons.