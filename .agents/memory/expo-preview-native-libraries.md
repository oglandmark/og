---
name: Expo preview native libraries
description: System libraries required for the Replit Expo workflow and the local package-manager constraint that affects preview startup.
---

The Replit Expo workflow can start Metro while React Native DevTools fails to launch if the environment lacks GLib, NSPR/NSS, DBus, GTK accessibility, CUPS, GTK/Pango/Cairo/ALSA, DRM/XKB, Mesa, and GBM runtime libraries. These belong in the project Nix package list, not application code.

**Why:** Expo SDK 57's React Native DevTools executable loads native desktop libraries during workflow startup; missing libraries produce repeated `unknown error while installing React Native DevTools` messages even though the QR preview may still appear.

**How to apply:** Keep the required native packages in `.replit` and leave the root `packageManager` field unset for local Replit preview. A root pnpm 8 pin can make the local wrapper repeatedly self-install pnpm and abort, while EAS may still use its own pnpm 8 builder.

For Android Expo Go requests routed through the Replit Expo domain, Metro's `multipart/mixed` bundle negotiation can fail inside Expo Go even with HTTP 200. Strip that media type from the request's `Accept` header only for Replit Android bundle requests so Metro returns a regular JavaScript bundle.

**Why:** Expo Go's Android multipart reader does not reliably handle the streamed response after the Replit proxy, producing “Error while reading multipart response” with response code 200.

**How to apply:** Keep the workaround in Metro's `enhanceMiddleware`, scoped by `REPLIT_EXPO_DEV_DOMAIN` and `platform=android`; do not alter web requests or general local/EAS bundling.