'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<{ user: User }>('/api/auth/me');
      setUser(res.user);
      return res.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiPost<{ user: User; token: string }>('/api/auth/login', { email, password });
    setUser(res.user);
    if (res.token) {
      localStorage.setItem('ws_token', res.token);
      window.dispatchEvent(new Event('examflow:login'));
    }
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost<{ success: boolean }>('/api/auth/logout');
    } finally {
      setUser(null);
      localStorage.removeItem('ws_token');
      window.dispatchEvent(new Event('examflow:logout'));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
