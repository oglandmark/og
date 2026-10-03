---
name: Admin-only Agent cover access
description: Eligibility policy for uploading and removing public Agent profile cover photos.
---

Only Agent-role accounts explicitly enabled by an administrator may read, upload, or remove their cover photo. Accounts without that explicit grant, including self-registered Agent accounts, must default to disabled. Changing away from Agent clears the grant; changing to Agent does not grant it automatically.

**Why:** The user requested that only Agent IDs created or approved by an administrator can manage cover photos, and that other users cannot bypass the restriction through direct API calls. The account data does not record historical creator identity, so the admin-controlled allowlist is the authoritative signal.

**How to apply:** Keep the permission default-deny, enforce it on every API path that accesses or mutates `coverPhoto`, and leave profile-photo behavior available to all roles. Existing Agent IDs need a one-time admin grant because their creator cannot be inferred.