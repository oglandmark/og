---
name: Listing edit media
description: Rules for preserving and replacing seller listing media during wizard edits
---

Stored listing media must remain remote media during an edit; only picker-generated local URI schemes should be uploaded. When an optional stored media item is removed, send an explicit null so the backend clears it instead of treating omission as “leave unchanged”.

**Why:** Seller edits need to preserve existing uploads without duplicate uploads, while deletion must not silently retain the old asset.

**How to apply:** Keep remote URLs in their original media slots, upload only local replacements, and include nullable update fields for removals.