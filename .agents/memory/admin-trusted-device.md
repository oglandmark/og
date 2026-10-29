---
name: Admin trusted-device policy
description: Keep admin multi-factor authentication enabled while reducing repeat OTP prompts on a private device.
---

Outside the local Replit preview, admin OTP must remain required on new or expired devices. A browser can be trusted only after successful OTP and correct password, for a limited period; do not create a production-wide OTP bypass. Local preview password-only sign-in must be scoped to the Replit development host, and its configured preview password must also work with file-backed preview data. After a successful local preview password reset, keep the reset password instead of reapplying the shared preview password.

**Why:** The user first chose a trusted-device convenience for normal admin login, then explicitly requested no OTP/email verification in the local preview only. They also need OTP-based recovery to remain effective when the preview credential is reset.

**How to apply:** Keep the trust grant scoped to one browser, store only a server-side hash of its random token, protect it as an HttpOnly cookie, and revoke grants when the admin password is reset. In local preview, use the Replit dev-host signal together with local-preview mode for the OTP bypass; never rely on a broad environment flag alone or enable the bypass in production.
