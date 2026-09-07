import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ApiRequestError,
  adminOtpLogin,
  adminVerify,
  clearToken,
  getMe,
  getToken,
  loginWithAPI,
  loginWithSocial,
  logoutAPI,
  registerWithAPI,
  setToken,
} from '@/lib/api';
import { clearLocalAccountData } from '@/lib/accountCleanup';

export type Role = 'buyer' | 'agent' | 'developer' | 'admin';

export type User = {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone: string;
  role: Role;
  city?: string;
  area?: string;
  purpose?: string;
  agencyName?: string;
  yearsExperience?: string;
  specializations?: string[];
  cnic?: string;
  areasServed?: string[];
  companyName?: string;
  companyType?: string;
  registrationNo?: string;
  ntn?: string;
  address?: string;
  socialLink?: string;
  establishedYear?: string;
  businessAreas?: string[];
  website?: string;
  representativeName?: string;
  designation?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  joinedAt: string;
  authProvider?: string;
  avatarUrl?: string;
};

type AuthContextValue = {
  user: User | null;
  role: Role | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (user: User) => Promise<void>;
  loginAPI: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginSocial: (provider: 'google' | 'facebook', accessToken: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string; otpRequired?: boolean }>;
  verifyAdminOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  registerAPI: (payload: {
    name: string; username?: string; email?: string; password: string; phone?: string; role: Role;
    confirmPassword?: string; agencyName?: string; companyName?: string; city?: string;
  }) => Promise<{ success: boolean; error?: string; pendingApproval?: boolean; pendingMessage?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = '@og-landmark/user-v2';

function mapRole(r: string): Role {
  const low = (r || '').toLowerCase();
  if (low === 'admin') return 'admin';
  if (low === 'agent') return 'agent';
  if (low === 'developer' || low === 'seller') return 'developer';
  return 'buyer';
}

function mapApiUser(apiU: {
  id: number;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  role: string;
  city?: string;
  agencyName?: string;
  companyName?: string;
  verificationStatus?: string;
  joinedDate?: string;
  authProvider?: string;
  avatarUrl?: string;
}): User {
  return {
    id: String(apiU.id),
    name: apiU.name,
    username: apiU.username,
    email: apiU.email,
    phone: apiU.phone || '',
    role: mapRole(apiU.role),
    city: apiU.city,
    agencyName: apiU.agencyName,
    companyName: apiU.companyName,
    verificationStatus: (apiU.verificationStatus as User['verificationStatus']) || 'pending',
    joinedAt: apiU.joinedDate || new Date().toISOString(),
    authProvider: apiU.authProvider,
    avatarUrl: apiU.avatarUrl,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [raw, token] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
        getToken(),
      ]);
      if (!token) {
        await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }
      try {
        const apiU = await getMe();
        if (!mounted) return;
        const restored = mapApiUser(apiU);
        setUser(restored);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(restored)).catch(() => undefined);
      } catch (error: unknown) {
        // A 401 means the token is definitely invalid/expired. For a
        // temporary network failure, keep the local identity but protected
        // API calls will still fail until connectivity returns.
        if (error instanceof ApiRequestError && error.status === 401) {
          await clearToken();
          await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
          if (mounted) setUser(null);
        } else if (mounted && raw) {
          try { setUser(JSON.parse(raw) as User); } catch { setUser(null); }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })().catch(() => {
      if (mounted) {
        setUser(null);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (newUser: User) => {
    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser)).catch(() => undefined);
  }, []);

  const loginAPI = useCallback(async (
    identifier: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await loginWithAPI(identifier, password);
      if (!res.user) return { success: false, error: 'Invalid credentials' };
      const mapped = mapApiUser(res.user);
      await login(mapped);
      if (res.token) await setToken(res.token);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Login failed' };
    }
  }, [login]);

  // ── Admin: step 1 — verify credentials, triggers OTP email ──────────────────
  const loginAdmin = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string; otpRequired?: boolean }> => {
    try {
      const res = await adminVerify(email, password);
      if (res.success) return { success: true, otpRequired: true };
      return { success: false, error: 'Invalid admin credentials' };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Verification failed' };
    }
  }, []);

  // ── Admin: step 2 — verify OTP, complete login ───────────────────────────────
  const verifyAdminOtp = useCallback(async (
    email: string,
    otp: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await adminOtpLogin(email, otp);
      if (!res.success || !res.user) return { success: false, error: 'OTP verification failed' };
      const mapped = { ...mapApiUser(res.user), role: 'admin' as const, verificationStatus: 'verified' as const };
      await login(mapped);
      if (res.token) await setToken(res.token);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'OTP failed' };
    }
  }, [login]);

  const loginSocial = useCallback(async (
    provider: 'google' | 'facebook',
    accessToken: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await loginWithSocial(provider, accessToken);
      if (!res.user) return { success: false, error: 'Social login failed' };
      const mapped = { ...mapApiUser(res.user), verificationStatus: 'verified' as const };
      await login(mapped);
      if (res.token) await setToken(res.token);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Social login failed' };
    }
  }, [login]);

  const registerAPI = useCallback(async (payload: {
    name: string; username?: string; email?: string; password: string; phone?: string; role: Role;
    confirmPassword?: string; agencyName?: string; companyName?: string; city?: string;
  }): Promise<{ success: boolean; error?: string; pendingApproval?: boolean; pendingMessage?: string }> => {
    try {
      const backendRole = payload.role === 'agent' ? 'Agent'
        : payload.role === 'developer' ? 'Seller'
        : 'Buyer';
      const res = await registerWithAPI({ ...payload, role: backendRole });
      if (res.pending) {
        return { success: true, pendingApproval: true, pendingMessage: res.message ?? 'Your account is under review.' };
      }
      if (!res.user) return { success: false, error: 'Registration failed' };
      const mapped = {
        ...mapApiUser(res.user),
        phone: res.user.phone || payload.phone || '',
        role: payload.role,
        city: res.user.city || payload.city,
        agencyName: payload.agencyName,
        companyName: payload.companyName,
        verificationStatus: 'pending' as const,
      };
      await login(mapped);
      if (res.token) await setToken(res.token);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
    }
  }, [login]);

  const logout = useCallback(async () => {
    setUser(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined),
      logoutAPI().catch(() => clearToken()),
      clearLocalAccountData(),
    ]);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isLoggedIn: !!user,
      isAdmin: user?.role === 'admin',
      isLoading,
      login, loginAPI, loginSocial, loginAdmin, verifyAdminOtp, registerAPI, logout,
    }),
    [user, isLoading, login, loginAPI, loginSocial, loginAdmin, verifyAdminOtp, registerAPI, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
