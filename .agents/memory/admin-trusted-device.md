---
name: Admin trusted-device policy
description: Keep admin multi-factor authentication enabled while reducing repeat OTP prompts on a private device.
---

Admin OTP must stay required on new or expired devices. A browser can be trusted only after a successful OTP challenge and correct password, for a limited period; do not create a global OTP bypass.

**Why:** The user chose a trusted-device convenience instead of removing OTP from admin login.

**How to apply:** Keep the trust grant scoped to one browser, store only a server-side hash of its random token, protect it as an HttpOnly cookie, and revoke grants when the admin password is reset.

The user separately requested password-only admin sign-in for the local Replit preview. Keep that bypass behind a development-scoped opt-in flag and an `APP_ENV=local` check; always verify the admin password, and never enable this for production.

**Why:** The user needs to access the local preview without OTP email delivery, but production admin accounts must retain OTP.

**How to apply:** Set the opt-in only in the Replit development environment. Preserve the regular OTP flow whenever the flag is absent or the app environment is not local.
