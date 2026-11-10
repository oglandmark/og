# Android/iOS listing location and photo verification

## Verification record — 2026-10-25

**Physical-device checks: not run.** No EAS Simulator sessions were available for this app, and the local Expo device tunnel reported that no device target was connected. Expo web preview is not evidence for native permission prompts, native map gestures, or system photo-picker behavior. No billed simulator session or new app build was started.

**Automated checks run in this workspace:**

- Mobile location/media suite: 58 tests passed. This includes mocked grant/deny and GPS fallback cases, coordinate payload checks, upload transport safeguards, media URL normalization, and an authenticated listing lifecycle.
- Laravel `BackendGapClosureTest`: 39 tests and 642 assertions passed. Its mobile-flow coverage uses fake uploaded files to verify the upload response URL, public media-file route, and listing persistence/read-back of media URLs and coordinates.
- Expo brand-asset check and TypeScript typecheck passed.

These tests validate app logic and API behavior; they do not replace the physical-device checks below.

## Device test steps

Run the complete checklist on both an Android phone and an iPhone using an installed OG Landmark build connected to the intended API and a valid Mapbox build token.

1. **Fresh-install GPS allow:** open Post an Ad, choose a city, open the location picker, choose Use My Location, grant foreground location, and verify the pin/address move to the device position.
2. **GPS deny and recovery:** deny location once and verify the user can still place a pin manually. Deny permanently, tap GPS again, use Open Settings, enable location, return to the app, and retry successfully.
3. **City and map pin:** change city before selecting a pin and verify the map recenters; tap or drag to a different parcel and verify the pin and coordinates update. Confirm the location and finish the picker.
4. **Save and reopen:** submit a listing with a unique QA title, then open that saved listing in Edit. Verify the selected city, pin coordinates, and map position match the submitted location.
5. **Photo permission and selection:** test both Allow and Deny. On a denial, verify the message gives the platform's Settings path and Open Settings works. Grant access, select a photo, and verify its thumbnail appears. On iOS, also test limited photo-library access where offered.
6. **Upload and persisted media URL:** submit the listing and inspect the upload response URL and saved listing's `images`/cover URL. Reopen the listing and verify the image loads; the saved value must be a server URL, not a device `file://` or `content://` URI.
7. **Upload failure recovery:** temporarily disable connectivity or use a controlled failing API response, submit, and verify the error is visible, the listing is not falsely reported as saved, and selected photos remain so the user can retry after restoring connectivity.

Record OS version, device model, app version/build, API environment, outcome, and any screenshots for each platform. Do not use real customer addresses, photos, or account data in QA listings.

## Supported test/build limits

- The Expo app is configured for Android (`com.oglandmark.app`) and iOS (`com.oglandmark.app`); this record does not establish a minimum supported OS version.
- Native verification requires an installed Android/iOS app build. A browser preview cannot verify OS permission prompts, settings links, native gallery selection, or native WebView map camera gestures.
- Native maps use the Mapbox-backed WebView renderer; the app's selected EAS build environment must include `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- Automated GPS tests inject a provider and mocked geocoding; API media tests use fake uploaded files. Neither can establish physical-device GPS accuracy, real gallery behavior, carrier-network upload reliability, or production media hosting.

## iOS release configuration — 2026-11-10

- Enabled iPad support while retaining the existing `com.oglandmark.app` bundle identifier. The next iOS build number is `61`; Android remains `com.oglandmark.app`, version code `62`, and portrait-only.
- Expo's iOS config introspection confirms all four iPad interface orientations, portrait-only iPhone orientations, multitasking enabled, the configured photo/camera purpose strings, and an APNs entitlement in the generated iOS config.
- Added explicit purpose text for selected photos and camera capture. The app icon and color-only native launch screen already pass the workspace asset check.
- The login screen's Google, Apple, and Facebook buttons currently show “Coming Soon”; the available sign-in flow is email/password. Recheck Apple's Sign in with Apple rule if a third-party provider becomes functional before App Store review.
- Automated checks passed: iOS config tests (3), mobile regression suite (114), brand assets, and TypeScript typecheck. No dependency changes were made; the prior Expo SDK 57 alignment check remains applicable.
- **Not verified:** iOS distribution build/signing, App Store Connect access, APNs credentials or actual push delivery, Mapbox token in the selected iOS build environment, and native flows on iPhone/iPad. The Replit screenshot showed only the startup animation, so it does not verify signed-in screens or device behavior. No App Store submission or billed simulator/build was started; paid iOS build and simulator testing are out of scope.
