---
name: Admin trusted-device policy
description: Keep admin multi-factor authentication enabled while reducing repeat OTP prompts on a private device.
---

Outside the local Replit preview, admin OTP must remain required on new or expired devices. A browser can be trusted only after successful OTP and correct password, for a limited period; do not create a production-wide OTP bypass. The user separately requested password-only admin login for the local Replit preview.

**Why:** The user first chose a trusted-device convenience for normal admin login, then explicitly requested no OTP/email verification in the local preview only.

**How to apply:** Keep the trust grant scoped to one browser, store only a server-side hash of its random token, protect it as an HttpOnly cookie, and revoke grants when the admin password is reset. In the local preview, bypass OTP only when `APP_ENV=local`, while still checking the admin password. Never enable the bypass in production.
