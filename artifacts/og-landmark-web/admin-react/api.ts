export type AnyRecord = Record<string, unknown>;

export type AdminUser = {
  id?: string | number;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
};

export type AdminStats = Record<string, unknown>;
export type Announcement = {
  id?: string | number;
  title?: string;
  message?: string;
  body?: string;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
};

const apiBase = (() => {
  const configured = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL;
  return (configured || "/api").replace(/\/+$/, "");
})();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const token = localStorage.getItem("og_token");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (authenticated && token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: "include" });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const value = payload as AnyRecord | null;
    throw new ApiError(String(value?.error || value?.message || `Request failed (${response.status})`), response.status);
  }
  return payload as T;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as AnyRecord;
    for (const key of ["items", "data", "results", "announcements"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export const adminApi = {
  async login(identifier: string, password: string) {
    return request<{ success?: boolean; message?: string; token?: string; user?: AdminUser }>("/auth/admin-verify", {
      method: "POST",
      body: JSON.stringify({ email: identifier, password }),
    }, false);
  },
  verifyAdminOtp(email: string, otp: string) {
    return request<{ token: string; user: AdminUser }>("/auth/admin-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }, false);
  },
  stats: () => request<AdminStats>("/admin/stats"),
  properties: async () => asList<AnyRecord>(await request<unknown>("/admin/properties?limit=500")),
  users: async () => asList<AnyRecord>(await request<unknown>("/admin/users?role=all&limit=500")),
  mobileAgents: async () => asList<AnyRecord>(await request<unknown>("/admin/mobile-agents")),
  cityAgents: async () => asList<AnyRecord>(await request<unknown>("/admin/city-agents")),
  projects: async () => asList<AnyRecord>(await request<unknown>("/admin/developer-projects")),
  inquiries: async () => asList<AnyRecord>(await request<unknown>("/inquiries")),
  reports: async () => asList<AnyRecord>(await request<unknown>("/admin/reports?status=pending")),
  announcements: async () => asList<Announcement>(await request<unknown>("/admin/announcements")),
  createAnnouncement: (body: { title: string; message: string }) =>
    request<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(body) }),
  updateProperty: (id: string | number, body: AnyRecord) =>
    request<AnyRecord>(`/admin/properties/${encodeURIComponent(String(id))}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProperty: (id: string | number) =>
    request<unknown>(`/admin/properties/${encodeURIComponent(String(id))}`, { method: "DELETE" }),
  moderateProperty: (id: string | number, action: "approve" | "reject" | "request-changes" | "verify" | "feature", body: AnyRecord = {}) =>
    request<AnyRecord>(`/properties/${encodeURIComponent(String(id))}/${action}`, { method: "POST", body: JSON.stringify(body) }),
};

export { asList };
