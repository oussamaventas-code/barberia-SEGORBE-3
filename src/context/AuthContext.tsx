import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';

export interface AuthProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  staffId: number | null;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  authError: string | null;
  getToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchBackendProfile = async (user: User | null) => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await apiFetch<{ profile: AuthProfile }>('/api/admin/auth/me', { token });
      setProfile(res.profile);
      setAuthError(null);
    } catch (err: any) {
      setAuthError(err.message || 'No se pudo validar la sesión.');
      setProfile(null);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      await fetchBackendProfile(user);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await fetchBackendProfile(cred.user);
    } catch (err: any) {
      const msg =
        err?.code === 'auth/popup-blocked'
          ? 'El navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes para continuar.'
          : err?.code === 'auth/popup-closed-by-user'
          ? 'Inicio de sesión cancelado.'
          : err?.message || 'Error iniciando sesión con Google.';
      setAuthError(msg);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await fetchBackendProfile(auth.currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        authError,
        getToken,
        signInWithGoogle,
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
