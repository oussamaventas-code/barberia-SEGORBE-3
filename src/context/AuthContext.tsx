import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

/**
 * Sesión local de demostración (email + contraseña contra la base de datos local).
 * El token firmado por el servidor se guarda en localStorage.
 */

export interface AuthProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  staffId: number | null;
}

interface AuthContextValue {
  profile: AuthProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  authError: string | null;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const STORAGE_KEY = 'cs_session_token';
const AuthContext = createContext<AuthContextValue | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode): session lasts only for this page
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (tk: string | null) => {
    if (!tk) {
      setProfile(null);
      return;
    }
    try {
      const res = await apiFetch<{ profile: AuthProfile }>('/api/admin/auth/me', { token: tk });
      setProfile(res.profile);
      setAuthError(null);
    } catch {
      // Expired or invalid token: clear silently
      writeToken(null);
      setToken(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    fetchProfile(token).finally(() => setLoading(false));
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getToken = useCallback(async () => token, [token]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const res = await apiFetch<{ token: string; profile: AuthProfile }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      writeToken(res.token);
      setToken(res.token);
      setProfile(res.profile);
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'No se pudo iniciar sesión.');
      return false;
    }
  };

  const logout = async () => {
    writeToken(null);
    setToken(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await fetchProfile(token);
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        isAuthenticated: Boolean(profile),
        loading,
        authError,
        getToken,
        signIn,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
