---
name: Admin trusted-device policy
description: Keep admin multi-factor authentication enabled while reducing repeat OTP prompts on a private device.
---

Admin OTP must stay required on new or expired devices. A browser can be trusted only after a successful OTP challenge and correct password, for a limited period; do not create a global OTP bypass.

**Why:** The user chose a trusted-device convenience instead of removing OTP from admin login.

**How to apply:** Keep the trust grant scoped to one browser, store only a server-side hash of its random token, protect it as an HttpOnly cookie, and revoke grants when the admin password is reset.
