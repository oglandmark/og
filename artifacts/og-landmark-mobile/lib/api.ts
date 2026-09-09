/**
 * OG Landmark — Centralized API Client
 * -------------------------------------
 * Dev URL  : set EXPO_PUBLIC_API_URL in .env.local
 * Prod URL : https://oglandmark.com
 *
 * All requests include the auth token stored in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Base URL ──────────────────────────────────────────────────────────────────
// Override via EXPO_PUBLIC_API_URL in .env.local (no trailing /api)
// e.g.  EXPO_PUBLIC_API_URL=https://oglandmark.com
// The mobile app's API must use the live OG Landmark backend by default.
// EXPO_PUBLIC_DOMAIN is the Expo preview host, not the product API host, so
// it must never silently redirect authentication requests to a temporary
// Replit domain.
const configuredApiUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE: string =
  configuredApiUrl ||
  'https://oglandmark.com';

const TOKEN_KEY = '@og-landmark/api-token';

// ─── Token helpers ─────────────────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
}
export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => undefined);
}
export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS       = 45_000; // 45s — handles slow mobile connections
const AUTH_FETCH_TIMEOUT_MS  = 60_000; // 60s — login/register on slow networks
const SESSION_FETCH_TIMEOUT_MS = 10_000;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (withAuth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const message = typeof err === 'object' && err !== null
        ? (err as { error?: string; message?: string; detail?: string }).error
          || (err as { message?: string }).message
          || (err as { detail?: string }).detail
        : undefined;
      throw new ApiRequestError(
        message || `HTTP ${res.status}`,
        res.status,
        typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined,
      );
    }
    return res.json() as Promise<T>;
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
    }
    throw e;
  }
}

const apiFetch = apiRequest;

// Multipart fetch (for file uploads)
async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = typeof err === 'object' && err !== null
      ? (err as { error?: string; message?: string; detail?: string }).error
        || (err as { message?: string }).message
        || (err as { detail?: string }).detail
      : undefined;
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Inquiry & Appointment submission ─────────────────────────────────────────

export type InquiryPayload = {
  propertyId: number;
  propertyTitle: string;
  clientName: string;
  email?: string;
  phone: string;
  message: string;
  sellerId?: number;
  buyerId?: number;
  agentId?: number;
};

export type AppointmentPayload = {
  propertyId: number;
  propertyTitle: string;
  propertyAddress: string;
  buyerId?: number;
  buyerName: string;
  sellerId?: number;
  agentId?: number;
  date: string;   // YYYY-MM-DD
  time: string;   // e.g. "10:00 AM"
  type: 'Site Visit' | 'Video Call';
};

export async function submitInquiry(payload: InquiryPayload) {
  return apiFetch<{ id: number }>('/api/inquiries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function bookAppointment(payload: AppointmentPayload) {
  return apiFetch<{ id: number }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Server scopes these to the authenticated user — no buyer_id param needed
export async function getMyInquiries() {
  return apiFetch<unknown[]>('/api/inquiries');
}

export async function getMyAppointments() {
  return apiFetch<unknown[]>('/api/appointments');
}

// ─── Health ────────────────────────────────────────────────────────────────────
export async function checkHealth(): Promise<{ status: string }> {
  return apiFetch('/api/health', {}, false);
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export type ApiUser = {
  id: number;
  name: string;
  username?: string;
  email: string;
  phone: string;
  role: string;
  status?: string;
  pushToken?: string;
  verificationStatus?: string;
  joinedDate?: string;
  city?: string;
  agencyName?: string;
  companyName?: string;
  authProvider?: string;
  facebookId?: string;
  googleId?: string;
  avatarUrl?: string;
};

// Server returns { user, token } on success (no `success` field)
export type LoginResponse = {
  user: ApiUser;
  token: string;
  // Agent-pending path returns { pending: true, message } instead
  pending?: boolean;
  message?: string;
};

export async function loginWithAPI(identifier: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    // `identifier` is the current contract. Keep `email` as an alias for
    // older Hostinger deployments that still read req.body.email.
    body: JSON.stringify({ identifier, email: identifier, password }),
  }, false, AUTH_FETCH_TIMEOUT_MS);
  if (res.token) await setToken(res.token);
  return res;
}

export async function logoutAPI(): Promise<void> {
  try {
    await apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }, true, 10_000);
  } finally {
    await clearToken();
  }
}

// ─── Social login (Google / Facebook) ─────────────────────────────────────────
// Sends the OAuth access token to the LOCAL api-server which verifies it
// with Google/Facebook and returns a user + JWT.
export async function loginWithSocial(
  provider: 'google' | 'facebook',
  accessToken: string,
): Promise<LoginResponse> {
  const res = await apiFetch<LoginResponse>('/api/auth/social', {
    method: 'POST',
    body: JSON.stringify({ provider, accessToken }),
  }, false, AUTH_FETCH_TIMEOUT_MS);
  if (res.token) await setToken(res.token);
  return res;
}

export async function registerWithAPI(payload: {
  name: string; username?: string; email?: string; password: string; phone?: string; role: string;
  confirmPassword?: string; agencyName?: string; companyName?: string; city?: string;
}): Promise<LoginResponse> {
  // Server expects firstName / lastName separately
  const parts = payload.name.trim().split(' ');
  const firstName = parts[0] ?? payload.name;
  const lastName = parts.slice(1).join(' ');

  const res = await apiFetch<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName,
      lastName,
      username:       payload.username,
      email:         payload.email || undefined,
      phone:         payload.phone || undefined,
      password:      payload.password,
      confirmPassword: payload.confirmPassword ?? payload.password,
      role:          payload.role.toLowerCase(),
      city:          payload.city,
      // extra fields agents/sellers use
      specialization: payload.agencyName || payload.companyName,
    }),
  }, false, AUTH_FETCH_TIMEOUT_MS);
  if (res.token) await setToken(res.token);
  return res;
}

export async function getMe(): Promise<ApiUser> {
  return apiFetch<ApiUser>('/api/auth/me', {}, true, SESSION_FETCH_TIMEOUT_MS);
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; smtpOff?: boolean }> {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, false, AUTH_FETCH_TIMEOUT_MS);
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  }, false, AUTH_FETCH_TIMEOUT_MS);
}

export async function updateUser(userId: string, payload: Partial<{
  name: string; phone: string; email: string; agencyName: string; companyName: string; city: string;
}>): Promise<ApiUser> {
  return apiFetch<ApiUser>(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteMyAccount(userId: string): Promise<void> {
  // Identity is derived from the bearer token; never trust a client supplied ID.
  await apiFetch('/api/account', { method: 'DELETE' });
}

export async function updatePushToken(
  userId: number,
  pushToken: string,
  device?: { deviceId?: string; platform?: string; appVersion?: string },
): Promise<void> {
  await apiFetch(`/api/users/${userId}/push-token`, {
    method: 'PATCH',
    body: JSON.stringify({ pushToken, ...device }),
  });
}

// ─── Properties ────────────────────────────────────────────────────────────────
export type ApiProperty = {
  id: number;
  title: string;
  type: string;
  status: string;
  approvalStatus?: string;
  listingStatus?: string;
  price: number;
  area: number;
  areaUnit: string;
  bedrooms: number;
  bathrooms: number;
  city: string;
  district?: string;
  tehsil?: string;
  locality?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  address: string;
  description: string;
  images: string[];
  videoUrl?: string;
  amenities?: string[];
  featured?: boolean;
  views?: number;
  inquiryCount?: number;
  agentId?: number;
  sellerId?: number;
  sellerName?: string;
  sellerPhone?: string;
  createdAt?: string;
  tags?: string[];
  features?: string[];
  documents?: string[];
  propertyDetails?: Record<string, unknown>;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
    city?: string;
    district?: string;
    tehsil?: string;
    locality?: string;
    address?: string;
    province?: string;
    country?: string;
    postalCode?: string;
    source?: string;
    accuracy?: number | null;
    placeId?: string | null;
  };
  media?: {
    images?: Array<{ url: string; propertyId?: number; type?: string }>;
    videos?: Array<{ url: string; propertyId?: number; type?: string }>;
    documents?: Array<{ name?: string; url?: string; propertyId?: number; type?: string }>;
  };
  reviewHistory?: Array<{
    action: string; reason?: string; by?: number; byName?: string;
    fromStatus?: string | null; toStatus?: string; createdAt?: string;
  }>;
  rejectionReason?: string | null;
  changeRequest?: string | null;
  reviewedAt?: string;
  lat?: number;
  lng?: number;
  /** Present only on results returned by a nearby-distance query. */
  distanceKm?: number;
  propertyScore?: {
    location: number; construction: number; investment: number;
    amenities: number; futureGrowth: number; overall: number;
  };
};

// Geographic query params (all optional, backwards compatible):
//  • Map bounds — supply all four to filter by a viewport rectangle.
//  • Nearby distance — supply lat + lng + radiusKm to filter by distance;
//    results are sorted nearest-first and each carries a `distanceKm` field.
export type MapBounds = {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
};
export type NearbyQuery = {
  lat: number; lng: number; radiusKm: number;
};

export type PropertiesFilter = {
  type?: string; city?: string; status?: string; purpose?: string;
  minPrice?: number; maxPrice?: number; minBeds?: number;
  featured?: boolean; search?: string; limit?: number; offset?: number;
  // ── Geographic filters (optional) ─────────────────────────────────────
  // Map bounds
  minLat?: number; maxLat?: number; minLng?: number; maxLng?: number;
  // Nearby distance
  lat?: number; lng?: number; radiusKm?: number;
};

export async function getProperties(filters: PropertiesFilter = {}): Promise<ApiProperty[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
  const qs = params.toString();
  return apiFetch<ApiProperty[]>(`/api/properties${qs ? `?${qs}` : ''}`, {}, false);
}

/**
 * Fetch properties whose coordinates fall inside a map viewport rectangle.
 * Extra filters (type, city, price, etc.) may be combined via `extra`.
 */
export async function getPropertiesInBounds(
  bounds: MapBounds,
  extra: Omit<PropertiesFilter, 'minLat' | 'maxLat' | 'minLng' | 'maxLng' | 'lat' | 'lng' | 'radiusKm'> = {},
): Promise<ApiProperty[]> {
  return getProperties({ ...extra, ...bounds });
}

/**
 * Fetch properties within `radiusKm` of a point, sorted nearest-first.
 * Each returned property includes a `distanceKm` field.
 * Extra filters may be combined via `extra`.
 */
export async function getNearbyProperties(
  nearby: NearbyQuery,
  extra: Omit<PropertiesFilter, 'minLat' | 'maxLat' | 'minLng' | 'maxLng' | 'lat' | 'lng' | 'radiusKm'> = {},
): Promise<ApiProperty[]> {
  return getProperties({ ...extra, ...nearby });
}

export async function getProperty(id: number): Promise<ApiProperty> {
  return apiFetch<ApiProperty>(`/api/properties/${id}`, {}, false);
}

export async function incrementView(id: number): Promise<void> {
  await apiFetch(`/api/properties/${id}/views`, { method: 'PATCH' }, false).catch(() => undefined);
}

// ─── Saved properties ──────────────────────────────────────────────────────────
export async function getSaved(userId: number): Promise<number[]> {
  return apiFetch<number[]>(`/api/saved/${userId}`);
}

export async function toggleSavedAPI(userId: number, propertyId: number): Promise<{ saved: boolean }> {
  return apiFetch<{ saved: boolean }>(`/api/saved/${userId}/${propertyId}`, { method: 'POST' });
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export type NotificationCategory = 'properties' | 'projects' | 'announcements' | 'promotional' | 'account' | 'system';
export type AppNotification = {
  id: number;
  notificationId: string;
  recipientUserId: number;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  body: string;
  imageUrl?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  propertyId?: string | number | null;
  projectId?: string | number | null;
  announcementId?: string | number | null;
  deepLink?: string | null;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  isRead: boolean;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type NotificationPage = {
  items: AppNotification[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  unreadCount: number;
};

export type NotificationPreferences = {
  properties: boolean;
  projects: boolean;
  announcements: boolean;
  promotional: boolean;
  account: boolean;
  system: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  cities?: string[];
  propertyTypes?: string[];
};

export async function getNotifications(
  _userId?: number,
  options: { page?: number; limit?: number; category?: NotificationCategory | 'all' } = {},
): Promise<NotificationPage> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 25),
    category: options.category ?? 'all',
  });
  return apiFetch<NotificationPage>(`/api/notifications?${params.toString()}`);
}

export async function getNotificationUnreadCount(): Promise<number> {
  const result = await apiFetch<{ unreadCount: number }>('/api/notifications/unread-count');
  return result.unreadCount;
}

export async function markNotificationRead(id: number | string): Promise<void> {
  await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(category: NotificationCategory | 'all' = 'all'): Promise<void> {
  await apiFetch('/api/notifications/mark-all-read', {
    method: 'PATCH',
    body: JSON.stringify({ category }),
  });
}

export async function deleteNotification(id: number | string): Promise<void> {
  await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>('/api/notification-preferences');
}

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>('/api/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}

export type AdminAnnouncement = {
  id: number;
  title: string;
  message: string;
  imageUrl?: string | null;
  type: 'general' | 'important' | 'system' | 'promotional';
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  audience: { role?: string; city?: string };
  scheduleAt?: string | null;
  expiresAt?: string | null;
  status: 'draft' | 'scheduled' | 'sent';
  createdAt: string;
  sentAt?: string | null;
  recipientCount?: number;
};

export async function getAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  return apiFetch<AdminAnnouncement[]>('/api/admin/announcements');
}

export async function createAdminAnnouncement(payload: {
  title: string;
  message: string;
  imageUrl?: string;
  type: AdminAnnouncement['type'];
  priority: AdminAnnouncement['priority'];
  audience: { role?: string; city?: string };
  scheduleAt?: string | null;
  expiresAt?: string | null;
  sendNow?: boolean;
}): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>('/api/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendAdminAnnouncement(id: number): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>(`/api/admin/announcements/${id}/send`, { method: 'POST' });
}

export async function getAnnouncement(id: number): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>(`/api/announcements/${id}`);
}

// ─── Banner slides (mobile home screen) ───────────────────────────────────────
export type BannerSlide = {
  id: number;
  type: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  route: string;
  ctaParams: Record<string, string>;
  active: boolean;
  order: number;
};

export async function getBanners(): Promise<BannerSlide[]> {
  return apiFetch<BannerSlide[]>('/api/mobile/banners', {}, false);
}

// ─── Mobile settings ───────────────────────────────────────────────────────────
export type MobilePortalConfig = {
  title: string;
  overviewTitle?: string;
  quickActionsTitle?: string;
  recentLeadsTitle?: string;
  viewAllLeads?: string;
  totalLeadsLabel?: string;
  todayVisitsLabel?: string;
  upcomingVisitsLabel?: string;
  pendingTitle?: string;
  pendingSubtitle?: string;
  noLeadsTitle?: string;
  noLeadsSubtitle?: string;
  companyFallback?: string;
  inventoryTitle?: string;
  financialTitle?: string;
  recentProjectsTitle?: string;
  viewAllProjects?: string;
  promotionLabel?: string;
  promotionDescription?: string;
  noProjectsTitle?: string;
  noProjectsDescription?: string;
  createFirstProject?: string;
  showOverview?: boolean;
  showQuickActions?: boolean;
  showRecentLeads?: boolean;
  showInventory?: boolean;
  showFinancial?: boolean;
  showPromotion?: boolean;
  showRecentProjects?: boolean;
  statLabels?: Record<string, string>;
  statVisibility?: Record<string, boolean>;
  kpiLabels?: Record<string, string>;
  inventoryLabels?: Record<string, string>;
  financialLabels?: Record<string, string>;
  actionLabels?: Record<string, string>;
  actionVisibility?: Record<string, boolean>;
};

export type MobileContent = {
  global: {
    theme: Record<string, string>;
    screenVisibility: Record<string, boolean>;
    pushTemplates: { key: string; label: string; title: string; body: string }[];
  };
  homepage: {
    sections: Record<string, string>;
    browse: { enabled: boolean; showCategories: boolean; showTransactionSwitch: boolean };
    carousel: { intervalMs: number; videoMaxDurationMs: number; showDots: boolean; animationsEnabled: boolean };
    theme: { primary: string; action: string; overlayStart: string; overlayMiddle: string; overlayEnd: string };
    fallback: { imageUrl: string; videoUrl: string; eyebrow: string; title: string; subtitle: string; cta: string; route: string };
  };
  screens: {
    calculator: { title: string; subtitle: string; showUnitConverter: boolean; showPlotArea: boolean; showMoreTools: boolean };
    help: { heroTitle: string; heroSubtitle: string; faqs: { q: string; a: string }[] };
    onboarding: { buyerSlides: { icon: string; title: string; desc: string }[] };
    categories: Record<string, string>;
    navigation: Record<string, string>;
    profile: { title: string; subtitle: string; showRecentlyViewed: boolean; showSavedSearches: boolean };
    account: Record<string, string>;
    tools: Record<string, string>;
    portals: {
      agent: MobilePortalConfig;
      developer: MobilePortalConfig;
    };
  };
};

export type MobileSettings = {
  verificationBadgeEnabled: boolean;
  pushNotificationsEnabled: boolean;
  darkModeEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  appVersion: string;
  minAppVersion: string;
  content: MobileContent;
};

export async function getMobileSettings(): Promise<MobileSettings> {
  return apiFetch<MobileSettings>('/api/mobile/settings', {}, false);
}
export async function uploadImage(uri: string, filename = 'photo.jpg'): Promise<{ url: string }> {
  const form = new FormData();
  // React Native FormData accepts { uri, type, name }
  form.append('image', { uri, type: 'image/jpeg', name: filename } as unknown as Blob);
  return apiUpload<{ url: string }>('/api/upload/single', form);
}

export async function uploadVideo(uri: string, filename = 'video.mp4'): Promise<{ url: string }> {
  const form = new FormData();
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp4';
  const mimeType = ext === 'mov' ? 'video/quicktime' : ext === 'avi' ? 'video/x-msvideo' : 'video/mp4';
  form.append('video', { uri, type: mimeType, name: filename } as unknown as Blob);
  return apiUpload<{ url: string }>('/api/upload/video', form);
}

export async function uploadMultipleImages(uris: string[]): Promise<string[]> {
  const form = new FormData();
  uris.forEach((uri, i) => {
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    form.append('images', { uri, type: `image/${ext === 'png' ? 'png' : 'jpeg'}`, name: `photo_${i}.${ext}` } as unknown as Blob);
  });
  const res = await apiUpload<{ urls: string[] }>('/api/upload', form);
  return res.urls ?? [];
}

export async function uploadProfilePhoto(uri: string): Promise<{ url: string }> {
  const uploaded = await uploadImage(uri, `profile_${Date.now()}.jpg`);
  return apiFetch<{ url: string }>('/api/account/profile-photo', {
    method: 'PUT',
    body: JSON.stringify(uploaded),
  });
}

// ─── Properties CRUD (for agents / sellers posting listings) ──────────────────
export type CreatePropertyPayload = {
  title: string;
  type: string;
  status: string;
  listingStatus?: 'Active' | 'Pending' | 'Draft' | 'Paused' | 'Sold' | 'Rented';
  price: number;
  area: number;
  areaUnit?: string;
  bedrooms?: number;
  bathrooms?: number;
  city: string;
  address?: string;
  description?: string;
  images?: string[];
  videoUrl?: string;
  amenities?: string[];
  lat?: number;
  lng?: number;
  tags?: string[];
  district?: string;
  tehsil?: string;
  locality?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  placeId?: string;
  locationSource?: string;
  locationAccuracy?: number;
  features?: string[];
  documents?: string[];
  propertyDetails?: Record<string, unknown>;
  location?: ApiProperty['location'];
  media?: ApiProperty['media'];
  submissionState?: 'draft' | 'submitted';
};

export async function createProperty(payload: CreatePropertyPayload): Promise<ApiProperty> {
  return apiFetch<ApiProperty>('/api/properties', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProperty(id: number, payload: Partial<CreatePropertyPayload>): Promise<ApiProperty> {
  return apiFetch<ApiProperty>(`/api/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updatePropertyListingStatus(
  id: number,
  listingStatus: NonNullable<CreatePropertyPayload['listingStatus']>,
): Promise<ApiProperty> {
  return apiFetch<ApiProperty>(`/api/properties/${id}/listing-status`, {
    method: 'PATCH',
    body: JSON.stringify({ listingStatus }),
  });
}

export async function deleteProperty(id: number): Promise<void> {
  await apiFetch(`/api/properties/${id}`, { method: 'DELETE' });
}

// Returns the logged-in user's own properties — ALL approval statuses (Pending/Active/Rejected)
export async function getMyProperties(): Promise<ApiProperty[]> {
  return apiFetch<ApiProperty[]>('/api/my-properties').catch(() => []);
}

// ─── Offers ───────────────────────────────────────────────────────────────────
export type ApiOffer = {
  id: number;
  propertyId: number;
  propertyTitle?: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  offerAmount: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  createdAt?: string;
};

export async function getOffers(propertyId?: number): Promise<ApiOffer[]> {
  const qs = propertyId ? `?propertyId=${propertyId}` : '';
  return apiFetch<ApiOffer[]>(`/api/offers${qs}`).catch(() => []);
}

export async function createOffer(
  payload: Omit<ApiOffer, 'id' | 'status' | 'createdAt'>,
): Promise<ApiOffer> {
  return apiFetch<ApiOffer>('/api/offers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOffer(id: number, status: ApiOffer['status']): Promise<ApiOffer> {
  return apiFetch<ApiOffer>(`/api/offers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteOffer(id: number): Promise<void> {
  await apiFetch(`/api/offers/${id}`, { method: 'DELETE' });
}

// ─── Conversations & Messages ──────────────────────────────────────────────────
export type ApiConversation = {
  id: number;
  participants: number[];
  propertyId?: number;
  propertyTitle?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt?: string;
};

export type ApiMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  senderName?: string;
  text: string;
  createdAt: string;
};

export async function getConversations(): Promise<ApiConversation[]> {
  return apiFetch<ApiConversation[]>('/api/conversations').catch(() => []);
}

export async function createConversation(payload: {
  participants: number[];
  propertyId?: number;
}): Promise<ApiConversation> {
  return apiFetch<ApiConversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMessages(conversationId: number): Promise<ApiMessage[]> {
  return apiFetch<ApiMessage[]>(`/api/conversations/${conversationId}/messages`).catch(() => []);
}

export async function sendMessage(
  conversationId: number,
  payload: { senderId: number; text: string },
): Promise<ApiMessage> {
  return apiFetch<ApiMessage>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteConversation(id: number): Promise<void> {
  await apiFetch(`/api/conversations/${id}`, { method: 'DELETE' });
}

// ─── Blog ─────────────────────────────────────────────────────────────────────
export type ApiBlogPost = {
  id: number;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  image?: string;
  author?: string;
  category?: string;
  tags?: string[];
  publishedAt?: string;
  createdAt?: string;
};

export async function getBlogPosts(
  params: { limit?: number; category?: string } = {},
): Promise<ApiBlogPost[]> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.category) qs.set('category', params.category);
  return apiFetch<ApiBlogPost[]>(
    `/api/blog${qs.toString() ? `?${qs}` : ''}`,
    {},
    false,
  ).catch(() => []);
}

export async function getBlogPost(id: number): Promise<ApiBlogPost> {
  return apiFetch<ApiBlogPost>(`/api/blog/${id}`, {}, false);
}

// ─── Agents (public listing) ───────────────────────────────────────────────────
export type ApiAgent = {
  id: number | string;
  name: string;
  displayName?: string;
  phone?: string;
  email?: string;
  agency?: string;
  agencyName?: string;
  city?: string;
  specialization?: string;
  experience?: string;
  verificationStatus?: string;
  verified?: boolean;
  rating?: number;
  reviewCount?: number;
  years?: number;
  listings?: number;
  areas?: string[];
  color?: string;
  specialties?: string[];
  about?: string;
  photo?: string;
  profilePhoto?: string;
  createdAt?: string;
};

function resolveAgentPhoto(value?: string | null): string | undefined {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : `${API_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

export async function getAgents(
  params: { city?: string; limit?: number } = {},
): Promise<ApiAgent[]> {
  const qs = new URLSearchParams();
  if (params.city) qs.set('city', params.city);
  if (params.limit) qs.set('limit', String(params.limit));
  const agents = await apiFetch<ApiAgent[]>(
    `/api/mobile-agents${qs.toString() ? `?${qs}` : ''}`,
    {},
    false,
  );
  return agents.map((agent) => ({
    ...agent,
    profilePhoto: resolveAgentPhoto(agent.profilePhoto || agent.photo),
    photo: resolveAgentPhoto(agent.photo || agent.profilePhoto),
  }));
}

// ─── Admin operations ─────────────────────────────────────────────────────────
export type AdminStats = {
  totalProperties:  number;
  totalUsers:       number;
  totalAgents?:     number;
  totalInquiries?:  number;
  pendingApprovals?: number;
  activeListings?:  number;
  featuredListings?: number;
  pendingReports?:  number;
  totalReports?:    number;
  totalViews?:      number;
};

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>('/api/admin/stats');
}

export async function getAdminProperties(
  params: { limit?: number; status?: string } = {},
): Promise<ApiProperty[]> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  return apiFetch<ApiProperty[]>(
    `/api/admin/properties${qs.toString() ? `?${qs}` : ''}`,
  ).catch(() => []);
}

export async function verifyAdminProperty(id: number): Promise<void> {
  await apiFetch(`/api/admin/properties/${id}/verify`, { method: 'PATCH' });
}

export async function featureAdminProperty(id: number): Promise<void> {
  await apiFetch(`/api/admin/properties/${id}/feature`, { method: 'PATCH' });
}

export async function deleteAdminProperty(id: number): Promise<void> {
  await apiFetch(`/api/admin/properties/${id}`, { method: 'DELETE' });
}

export async function getAdminUsers(
  params: { limit?: number; role?: string } = {},
): Promise<ApiUser[]> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.role) qs.set('role', params.role);
  return apiFetch<ApiUser[]>(
    `/api/admin/users${qs.toString() ? `?${qs}` : ''}`,
  ).catch(() => []);
}

export async function updateUserRole(userId: number, role: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
}

// ── Admin property actions ──────────────────────────────────────────────────
export async function approveProperty(id: number): Promise<void> {
  await apiFetch(`/api/properties/${id}/approve`, { method: 'PATCH' });
}
export async function rejectProperty(id: number, reason?: string): Promise<void> {
  await apiFetch(`/api/properties/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}
export async function requestPropertyChanges(id: number, reason: string): Promise<void> {
  await apiFetch(`/api/properties/${id}/request-changes`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}
export async function resubmitProperty(id: number): Promise<void> {
  await apiFetch(`/api/properties/${id}/resubmit`, { method: 'PATCH' });
}
export type AdminPropertyReview = {
  property: ApiProperty;
  seller: { id: number; name?: string; role?: string; email?: string; phone?: string; agencyName?: string } | null;
  audit: ApiProperty['reviewHistory'];
};
export async function getAdminPropertyReview(id: number): Promise<AdminPropertyReview> {
  return apiFetch<AdminPropertyReview>(`/api/admin/properties/${id}/review`);
}
export async function toggleFeatureProperty(id: number, featured: boolean): Promise<void> {
  await apiFetch(`/api/admin/properties/${id}/feature`, {
    method: 'PATCH',
    body: JSON.stringify({ featured }),
  });
}

// ── Admin OTP login ──────────────────────────────────────────────────────────
export async function adminVerify(
  email: string, password: string,
): Promise<{ success: boolean; message?: string }> {
  return apiFetch('/api/auth/admin-verify', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
}
export async function adminOtpLogin(
  email: string, otp: string,
): Promise<{ success: boolean; user?: ApiUser; token?: string }> {
  return apiFetch('/api/auth/admin-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  }, false);
}

// ── Admin reports ─────────────────────────────────────────────────────────────
export type AdminReport = {
  id: number; propertyId: number; reason: string; description?: string;
  status: 'Pending' | 'Resolved' | 'Dismissed';
  reportedAt: string; reporterName?: string;
};
export async function getAdminReports(status?: string): Promise<AdminReport[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<AdminReport[]>(`/api/admin/reports${qs}`).catch(() => []);
}
export async function updateAdminReport(id: number, status: string, adminNote?: string): Promise<void> {
  await apiFetch(`/api/admin/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, adminNote }),
  });
}

// ── Mobile settings ────────────────────────────────────────────────────────────
export async function updateMobileSettings(settings: Partial<MobileSettings>): Promise<void> {
  await apiFetch('/api/mobile/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ── Broadcast push notification ────────────────────────────────────────────────
export async function sendBroadcastPush(
  title: string,
  body: string,
  data?: Record<string, string | number | boolean>,
): Promise<void> {
  await apiFetch('/api/mobile/push', {
    method: 'POST',
    body: JSON.stringify({ title, body, data }),
  });
}

// ── Admin banner management ────────────────────────────────────────────────────
export async function createBanner(payload: {
  title: string; subtitle?: string; imageUrl: string; actionUrl?: string;
}): Promise<void> {
  await apiFetch('/api/mobile/banners', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
export async function deleteBanner(id: number): Promise<void> {
  await apiFetch(`/api/mobile/banners/${id}`, { method: 'DELETE' });
}
export async function toggleBanner(id: number): Promise<void> {
  await apiFetch(`/api/mobile/banners/${id}/toggle`, { method: 'PATCH' });
}
