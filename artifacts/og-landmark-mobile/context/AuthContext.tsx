import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginWithAPI, loginWithSocial, registerWithAPI, clearToken, setToken, adminVerify, adminOtpLogin } from '@/lib/api';
import { clearLocalAccountData } from '@/lib/accountCleanup';

export type Role = 'buyer' | 'agent' | 'developer' | 'admin';

export type User = {
  id: string;
  name: string;
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
};

type AuthContextValue = {
  user: User | null;
  role: Role | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (user: User) => Promise<void>;
  loginAPI: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginSocial: (provider: 'google' | 'facebook', accessToken: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string; otpRequired?: boolean }>;
  verifyAdminOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  registerAPI: (payload: {
    name: string; email: string; password: string; phone: string; role: Role;
    agencyName?: string; companyName?: string; city?: string;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setUser(JSON.parse(raw) as User); })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (newUser: User) => {
    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser)).catch(() => undefined);
  }, []);

  const loginAPI = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await loginWithAPI(email, password);
      if (!res.user) return { success: false, error: 'Invalid credentials' };
      const apiU = res.user;
      const mapped: User = {
        id:                 String(apiU.id),
        name:               apiU.name,
        email:              apiU.email,
        phone:              apiU.phone || '',
        role:               mapRole(apiU.role),
        city:               apiU.city,
        agencyName:         apiU.agencyName,
        companyName:        apiU.companyName,
        verificationStatus: (apiU.verificationStatus as User['verificationStatus']) || 'pending',
        joinedAt:           apiU.joinedDate || new Date().toISOString(),
      };
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
      const apiU = res.user;
      const mapped: User = {
        id:                 String(apiU.id),
        name:               apiU.name,
        email:              apiU.email,
        phone:              apiU.phone || '',
        role:               'admin',
        verificationStatus: 'verified',
        joinedAt:           new Date().toISOString(),
      };
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
      const apiU = res.user;
      const mapped: User = {
        id:                 (apiU as { socialId?: string }).socialId ?? String(apiU.id),
        name:               apiU.name,
        email:              apiU.email,
        phone:              apiU.phone || '',
        role:               mapRole(apiU.role),
        verificationStatus: 'verified',
        joinedAt:           apiU.joinedDate || new Date().toISOString(),
      };
      await login(mapped);
      if (res.token) await setToken(res.token);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Social login failed' };
    }
  }, [login]);

  const registerAPI = useCallback(async (payload: {
    name: string; email: string; password: string; phone: string; role: Role;
    agencyName?: string; companyName?: string; city?: string;
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
      const apiU = res.user;
      const mapped: User = {
        id:                 String(apiU.id),
        name:               apiU.name,
        email:              apiU.email,
        phone:              apiU.phone || payload.phone,
        role:               payload.role,
        city:               apiU.city || payload.city,
        agencyName:         payload.agencyName,
        companyName:        payload.companyName,
        verificationStatus: 'pending',
        joinedAt:           new Date().toISOString(),
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
      clearToken(),
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
