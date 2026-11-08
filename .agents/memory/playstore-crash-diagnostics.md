---
name: Play Store crash diagnostics
description: Accessing Google Play Android Vitals crash reports through the Expo MCP tools.
---

Expo MCP's Play Store crash lookup cannot retrieve Android Vitals until a Google Service Account key is configured in the Expo account.

**Why:** The app's code and tests cannot reveal a production native startup exception; the Expo crash lookup returned that the service-account setup was missing.

**How to apply:** When investigating a Play Store launch crash, use the Android Vitals trace rather than treating a user video as the underlying exception. Check access first; never ask the user to paste service-account credentials into chat.
