---
name: Location picker camera sync
description: Native listing-map behavior when a user changes locality or enables GPS after location services were off
---

City and locality selection should control the map camera until the user chooses an exact pin. Native WebView maps need an explicit zoom value for city presets; latitude/longitude deltas alone do not set their Leaflet zoom. Remount or synchronize the map on city changes, but only treat region events tagged as user gestures as a selected pin. Debounce pinch-region updates and stop touch propagation; form pickers should open in a full-screen modal so parent scrolling cannot steal map gestures. On Android Expo Go, recover pinch state on both touch-end and touch-cancel, restoring map dragging afterward.

**Why:** Web previews do not reproduce native map-camera state or Android permission/service recovery. Programmatic `setView` events can look like user pin changes, repeated pinch callbacks can create address lookup churn, and nested form scrolling can intercept map movement.

**How to apply:** Pass both city and locality into the picker, resolve locality coordinates before displaying the fallback city center, synchronize native camera props when there is no exact pin, and distinguish gesture-originated region changes from programmatic camera sync. Bound GPS requests with balanced/last-known fallbacks so the form cannot remain stuck in a loading state. Manual map taps/drags must persist the coordinates immediately; reverse geocoding enriches the address but must not block saving a valid pin.