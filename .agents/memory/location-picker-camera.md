---
name: Location picker camera sync
description: Native listing-map behavior when a user changes locality or enables GPS after location services were off
---

City and locality selection should control the map camera until the user chooses an exact pin. Native WebView maps need an explicit zoom value for city presets; latitude/longitude deltas alone do not set their Leaflet zoom. When a full-screen picker changes cities, remount or explicitly synchronize the map before treating camera events as user-selected pins. On Android Expo Go, recover pinch state on both touch-end and touch-cancel, restoring map dragging afterward.

**Why:** Web previews do not reproduce native map-camera state or Android permission/service recovery. A preserved WebView can retain its previous viewport, and interrupted two-finger gestures can otherwise leave map dragging disabled.

**How to apply:** Pass both city and locality into the picker, resolve locality coordinates before displaying the fallback city center, synchronize native camera props when there is no exact pin, and bound GPS requests with balanced/last-known fallbacks so the form cannot remain stuck in a loading state. Manual map taps/drags must persist the coordinates immediately; reverse geocoding enriches the address but must not block saving a valid pin.