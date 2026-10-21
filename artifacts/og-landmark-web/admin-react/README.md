# OG Landmark Admin Dashboard

React Native + TypeScript source for the website's single React Native Web `/admin/*` dashboard.

## Build assumptions

- The website package provides compatible versions of `react`, `react-dom`, and `react-native-web`, plus Vite and the React plugin.
- Vite must alias `react-native` to `react-native-web` (or use an equivalent React Native Web resolver) and include the RNW web entry in its output.
- Entry point: `main.tsx`; mount element: `#root`; Vite outputs to `public/admin/rn-assets/`.
- `App.tsx` uses React Native Web primitives via the `react-native` package: `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Modal`, `Image`, and `StyleSheet`. The root entry uses React DOM to mount the RNW tree.
- The UI uses React Native Web primitives, with `react-native` aliased to `react-native-web`.
- Optional `VITE_API_BASE_URL` sets the API root; defaults to `/api`.
- Existing public brand image `/images/og-logo.png` is referenced for the brand area.

## API/auth assumptions

- All API calls are centralized in `api.ts`, use JSON, include credentials, and send the existing `og_token` as a bearer token.
- Login uses Laravel `POST /auth/admin-verify` and, where configured, `POST /auth/admin-otp`; returned token and safe user are persisted under `og_token` and `og_user`.
- Resource paths follow the supplied Laravel API contract. Authentication/authorization remains server-owned.
- Supported writes are property PATCH, DELETE, approve/reject/request-changes/verify/feature, and announcement POST. Unsupported workflows are explicitly presented as unavailable.
- The app does not invent records, metrics, or unsupported mutation routes. Inquiries and reports are view-only with existing endpoints.
