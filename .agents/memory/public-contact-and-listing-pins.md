---
name: Public contacts and listing pins
description: Project rules for buyer-facing property/agent contacts and exact admin listing coordinates.
---

Use `+923272569000` as OG Landmark's official WhatsApp number. Public WhatsApp links use the `923272569000` form; public phone labels use `03272569000` and telephone links use `+923272569000`. Do not rewrite phone numbers stored on seller, agent, or other user accounts.

Admin listing location should reflect the user's selected pin. Keep top-level `lat`/`lng` and nested `location.latitude`/`location.longitude` synchronized on edits; use top-level values first and nested values as a fallback when reading legacy records. Display the stored precision rather than rounding the pin.

**Why:** The user requested a single public contact number and accurate admin pins while preserving personal account contact data.

**How to apply:** Use this for buyer-facing property/agent call and WhatsApp controls and for admin listing-location views or edits. Do not change private account records to achieve the public contact behavior.
