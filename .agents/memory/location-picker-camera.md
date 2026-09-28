---
name: Location picker camera sync
description: Native listing-map behavior when a user changes locality or enables GPS after location services were off
---

City and locality selection should control the map camera until the user chooses an exact pin. GPS selection must update the same persisted latitude/longitude callback used by map taps and search, including after Android Location Services are enabled from Settings.

**Why:** Web previews do not reproduce native map-camera state or Android permission/service recovery, and an uncontrolled native camera can remain at the previous city even when the form state changes.

**How to apply:** Pass both city and locality into the picker, resolve locality coordinates before displaying the fallback city center, synchronize native camera props when there is no exact pin, and bound GPS requests with balanced/last-known fallbacks so the form cannot remain stuck in a loading state. Manual map taps/drags must persist the coordinates immediately; reverse geocoding enriches the address but must not block saving a valid pin.