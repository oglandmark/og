# OG Landmark mobile API: live route audit

**Audit date:** 2026-10-20

**Live base:** `https://www.oglandmark.com`

**Scope:** active mobile API calls in `lib/api.ts` and the mobile `lib/*Store.ts` files, compared with the Laravel API controller and developer service.

## Result

The source-derived route/method/auth matrix is below. Safe unauthenticated GET checks confirmed several public response contracts and confirmed that most tested private routes reject requests without a bearer token.

The production backend was **not healthy enough to approve write testing**:

- `GET /api/health` and `GET /api/healthz` both returned **503** with `status: degraded`.
- Health reported `database: connected`, `normalizedCoreStorage: not_active`, `smtp: configured`, and media storage `ready`; `mediaBaseUrl` was empty and `mediaStorage.publicBaseUrlConfigured` was false.
- No controlled test account or explicit approval for production writes was available. No production POST, PUT, PATCH, or DELETE request was sent.

One live mismatch was observed:

- Mobile calls `GET /api/comparison`, expecting an authenticated `number[]`.
- Workspace Laravel routes that path to its comparison handler, which requires authentication.
- Production returned **404 `Not found`** without a token, rather than the expected **401**. A request to plural `/api/comparisons` returned 401, but that is not the active mobile path. Treat the singular live route as a production parity issue; no write check was attempted.

## Route / method / authentication matrix

“Bearer” means the mobile API wrapper includes the stored bearer token; “none” means it explicitly omits it. Role requirements are additional to authentication. Methods and requirements are derived from the current mobile call sites and Laravel source; unless stated in the live results section, they were **not exercised against production**.

### Public reads and property lifecycle

| Mobile API path | Methods used | Mobile auth | Server access |
|---|---|---|---|
| `/api/health` | GET | None | Public health response |
| `/api/properties` | GET, POST | GET none; POST bearer | Public list; create requires account |
| `/api/properties/{id}` | GET, PUT, DELETE | GET none; writes bearer | Public visible listing; writes require owner or admin |
| `/api/properties/{id}/views` | PATCH | None | Public counter update |
| `/api/properties/{id}/listing-status` | PATCH | Bearer | Owner or admin |
| `/api/properties/{id}/approve`, `/reject`, `/request-changes`, `/resubmit` | PATCH | Bearer | Admin for approve/reject/request changes; owner/admin for resubmit |
| `/api/admin/properties` | GET | Bearer | Admin |
| `/api/admin/properties/{id}/review` | GET | Bearer | Admin |
| `/api/admin/properties/{id}/verify`, `/feature` | PATCH | Bearer | Admin |
| `/api/admin/properties/{id}` | DELETE | Bearer | Admin |
| `/api/my-properties` | GET | Bearer | Authenticated account; returns its own listings |
| `/api/projects`, `/api/projects/{id}` | GET | None | Public projects |

### Authentication, account and profile

| Mobile API path | Methods used | Mobile auth | Server access |
|---|---|---|---|
| `/api/auth/login`, `/register`, `/social` | POST | None | Public credential/provider flows |
| `/api/auth/forgot-password`, `/reset-password` | POST | None | Public reset flow |
| `/api/auth/me` | GET | Bearer | Authenticated account |
| `/api/auth/logout` | POST | Bearer | Invalidates the presented session |
| `/api/auth/admin-verify`, `/admin-otp` | POST | None | Credentials/OTP required by request body |
| `/api/users/{userId}` | PUT | Bearer | Own account or admin |
| `/api/users/{userId}/push-token` | PATCH | Bearer | Authenticated account matching the ID, or admin |
| `/api/account` | DELETE | Bearer | Deletes the authenticated account and its associated data |
| `/api/account/profile-photo` | GET, PUT, DELETE | Bearer | Authenticated account |
| `/api/account/cover-photo` | GET, PUT, DELETE | Bearer | Admin-enabled Agent account or admin |

### Buyer, seller and agent data

| Mobile API path | Methods used | Mobile auth | Server access |
|---|---|---|---|
| `/api/inquiries` | GET, POST | Bearer | Authenticated account |
| `/api/inquiries/{id}` | DELETE | Bearer | Authenticated owner/admin |
| `/api/appointments` | GET, POST | Bearer | Authenticated account |
| `/api/offers` | GET, POST | Bearer | Authenticated account |
| `/api/offers/{id}` | PATCH, DELETE | Bearer | Authenticated owner/admin |
| `/api/saved/{userId}` | GET | Bearer | Same account or admin |
| `/api/saved/{userId}/{propertyId}` | POST | Bearer | Same account or admin; toggles saved state |
| `/api/conversations` | GET, POST | Bearer | Authenticated participant/admin |
| `/api/conversations/{id}/messages` | GET, POST | Bearer | Conversation participant/admin |
| `/api/conversations/{id}` | DELETE | Bearer | Conversation participant/admin |
| `/api/agent-leads` | GET, POST | Bearer | Authenticated account; record ownership is enforced |
| `/api/agent-leads/{id}` | PUT, PATCH, DELETE | Bearer | Record owner/admin |
| `/api/agent-visits` | GET, POST | Bearer | Authenticated account; role/record ownership applies |
| `/api/agent-visits/{id}` | PATCH, DELETE | Bearer | Record owner/admin |
| `/api/visit-history` | GET, POST, DELETE | Bearer | Authenticated account |
| `/api/visit-history/{propertyId}` | DELETE | Bearer | Authenticated account |

### Saved data and notifications

| Mobile API path | Methods used | Mobile auth | Server access |
|---|---|---|---|
| `/api/comparison` | GET, PUT, DELETE | Bearer | Authenticated account; live GET returned 404 (see result above) |
| `/api/measurements` | GET, POST | Bearer | Authenticated account |
| `/api/measurements/{id}` | DELETE | Bearer | Authenticated owner |
| `/api/saved-searches` | GET, POST, DELETE | Bearer | Authenticated account; collection DELETE clears own searches |
| `/api/saved-searches/{id}` | DELETE | Bearer | Authenticated owner |
| `/api/recent-searches` | GET, POST, DELETE | Bearer | Authenticated account |
| `/api/recent-searches/{query}` | DELETE | Bearer | Authenticated account |
| `/api/notifications` | GET | Bearer | Authenticated recipient |
| `/api/notifications/unread-count` | GET | Bearer | Authenticated recipient |
| `/api/notifications/mark-all-read` | PATCH | Bearer | Authenticated recipient |
| `/api/notifications/{id}/read` | PATCH | Bearer | Authenticated recipient |
| `/api/notifications/{id}` | DELETE | Bearer | Authenticated recipient |
| `/api/notification-preferences` | GET, PUT | Bearer | Authenticated account |

### Developer workspace

All `/api/developer/*` operations require a bearer token and a Developer, Seller, or Admin role, except `/api/developer/site-visits/mine`, which is an authenticated user’s own-visit read.

| Mobile API path | Methods used |
|---|---|
| `/api/developer/projects` | GET, POST |
| `/api/developer/projects/{id}` | PUT, DELETE |
| `/api/developer/projects/{id}/blocks`, `/units` | GET |
| `/api/developer/blocks`, `/units` | POST |
| `/api/developer/blocks/{id}`, `/units/{id}` | PUT, DELETE |
| `/api/developer/payment-plans`, `/documents`, `/team`, `/leads`, `/site-visits` | GET, POST |
| `/api/developer/payment-plans/{id}`, `/documents/{id}`, `/team/{id}`, `/leads/{id}`, `/site-visits/{id}` | PUT or PATCH as used by each store; DELETE |
| `/api/developer/team/{id}/active` | PATCH |
| `/api/developer/leads/{id}` | PATCH for status/notes |
| `/api/developer/site-visits/mine` | GET |
| `/api/projects`, `/api/projects/{id}` | GET, public (also listed above) |

### Admin, mobile content, uploads and public content

| Mobile API path | Methods used | Mobile auth | Server access |
|---|---|---|---|
| `/api/admin/stats`, `/api/admin/users`, `/api/admin/reports` | GET | Bearer | Admin |
| `/api/admin/users/{id}/role`, `/agent-cover-access` | PATCH | Bearer | Admin |
| `/api/admin/users/{id}` | DELETE | Bearer | Admin |
| `/api/admin/reports/{id}` | PATCH | Bearer | Admin |
| `/api/admin/demo-properties` | PATCH | Bearer | Admin |
| `/api/admin/announcements` | GET, POST | Bearer | Admin |
| `/api/admin/announcements/{id}/send` | POST | Bearer | Admin; sends notifications |
| `/api/announcements/{id}` | GET | Bearer is included by the wrapper | Public sent announcement; missing/expired IDs return 404 |
| `/api/mobile/settings` | GET, PUT | GET none; PUT bearer | Public read; admin write |
| `/api/mobile/push` | POST | Bearer | Admin; broadcasts notifications |
| `/api/mobile/banners` | GET, POST | Public GET; bearer POST | Public read; admin write |
| `/api/mobile/banners/all` | GET | Bearer | Admin |
| `/api/mobile/banners/{id}` | DELETE | Bearer | Admin |
| `/api/mobile/banners/{id}/toggle` | PATCH | Bearer | Admin |
| `/api/upload/single`, `/api/upload/video`, `/api/upload` | POST multipart | Bearer | Authenticated account |
| `/api/blog`, `/api/blog/{id}` | GET | None | Public |
| `/api/mobile-agents` | GET | None | Public; optional city/limit filters |

## Safe production checks performed

Only GET requests were sent, with no bearer token. Response bodies were reduced to JSON type/key shapes before logging; no listing/account payload was retained in this report.

| Live request | Result |
|---|---|
| `GET /api/health` | 503; degraded health payload |
| `GET /api/healthz` | 503; same degraded health contract |
| `GET /api/properties?limit=1&paginated=true` | 200; object with `items`, `total`, `offset`, `limit`, `hasMore` |
| `GET /api/properties/{id}` | 200; object with the expected property fields (ID not retained here) |
| `GET /api/blog?limit=1` | 200; array of blog-post objects |
| `GET /api/blog/{id}` | 200; blog-post object |
| `GET /api/mobile/settings` | 200; settings object with expected top-level fields |
| `GET /api/mobile-agents?limit=1` | 200; array |
| `GET /api/projects` | 200; array |
| `GET /api/agents?limit=1` | 200; array (not an active `api.ts` call site) |
| `GET /api/announcements` | 200; empty array, so no valid live announcement ID was available to verify the mobile detail path |
| `GET /api/auth/me`, `/my-properties`, `/saved-searches` | 401 each |
| `GET /api/notifications`, `/notifications/unread-count`, `/notification-preferences` | 401 each |
| `GET /api/developer/projects`, `/developer/site-visits/mine` | 401 each |
| `GET /api/developer/analytics` | 401; auxiliary probe only, not an active mobile API call site |
| `GET /api/inquiries`, `/appointments`, `/offers`, `/conversations` | 401 each |
| `GET /api/agent-leads`, `/agent-visits`, `/recent-searches`, `/visit-history`, `/measurements` | 401 each |
| `GET /api/admin/stats`, `/admin/properties`, `/account/profile-photo` | 401 each |
| `GET /api/mobile/banners/all` | 401 before banner data is read |
| `GET /api/comparison` | **404**, unexpected against the current Laravel source |
| `GET /api/comparisons` | 401; plural path is protected but is not used by mobile |
| `GET /api/announcements/1` | 404; no sent, unexpired announcement was available, so this does not verify a successful item response |

The public `GET /api/mobile/banners` was deliberately not used as a health probe. Current Laravel code can seed/migrate banner data and write it during that GET, so it is not guaranteed to be read-only.

## External map and geocoding providers (not Laravel routes)

These calls originate directly from the mobile client and were not included in Laravel endpoint verification:

- **Google Maps Platform:** Places autocomplete/details and native geocoding, from `lib/geocodingService.ts`; uses the build-time public Google Maps key.
- **Nominatim / OpenStreetMap:** locality search and browser reverse-geocoding fallback, also from `lib/geocodingService.ts`.
- **Mapbox:** map tiles and styles from map components and `components/MapViewModes.ts`; the token is configured for mobile builds.

Provider availability, credentials, quotas, and live map rendering were not tested in this Laravel audit.

## Follow-up needed before full sign-off

1. Restore healthy production readiness (`normalizedCoreStorage` and public media base URL) and confirm both health endpoints return the expected ready status.
2. Compare/deploy the production API route implementation so the active singular `/api/comparison` path matches the mobile contract. Do not replace it with `/api/comparisons` without updating the mobile client and verifying backward compatibility.
3. With an explicitly approved, isolated test account, run bearer-authenticated read checks and reversible create/update/delete checks; verify each returned JSON shape and clean up only the test account’s own records.
