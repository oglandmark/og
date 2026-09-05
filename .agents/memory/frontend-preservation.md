---
name: OG Landmark frontend preservation
description: Defines which supplied compiled website files may change during future backend or admin work.
---

Keep the supplied public website pages and compiled assets visually and byte-for-byte unchanged. Functional extensions belong in the admin dashboard only and must reuse its existing visual language.

**Why:** The user explicitly requires the supplied website frontend to remain exactly as delivered while still giving administrators complete control over mobile-backed data.

**How to apply:** Before future website changes, compare public-site asset hashes against the supplied package. Do not rebuild or reformat compiled assets; limit necessary frontend edits to admin management functionality.