---
name: Public contacts and listing pins
description: Project rules for buyer-facing property/agent contacts and exact admin listing coordinates.
---

Use `03011484303` for public property and agent call/WhatsApp actions. Keep telephone links in international form and WhatsApp links in the `923011484303` form. Do not rewrite phone numbers stored on seller, agent, or other user accounts.

Admin listing location should reflect the user's selected pin. Keep top-level `lat`/`lng` and nested `location.latitude`/`location.longitude` synchronized on edits; use top-level values first and nested values as a fallback when reading legacy records. Display the stored precision rather than rounding the pin.

**Why:** The user requested a single public contact number and accurate admin pins while preserving personal account contact data.

**How to apply:** Use this for buyer-facing property/agent call and WhatsApp controls and for admin listing-location views or edits. Do not change private account records to achieve the public contact behavior.
