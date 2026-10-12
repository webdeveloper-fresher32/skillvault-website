'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken, getAuthToken } from '@/lib/api';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  role: string;
}

interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: User;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalView: 'login' | 'register';
  login: (emailOrUsername: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  openAuthModal: (view?: 'login' | 'register') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'skillvault_access_token';
const REFRESH_TOKEN_KEY = 'skillvault_refresh_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'register'>('login');

  const updateTokens = useCallback((access: string | null, refresh: string | null) => {
    setAccessTokenState(access);
    setRefreshTokenState(refresh);
    setAuthToken(access);

    if (typeof window !== 'undefined') {
      try {
        if (access) {
          localStorage.setItem(ACCESS_TOKEN_KEY, access);
        } else {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
        }

        if (refresh) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
        } else {
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
      } catch (e) {
        console.error('Failed to access localStorage for auth tokens', e);
      }
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    let storedRefresh = refreshToken;
    if (!storedRefresh && typeof window !== 'undefined') {
      storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    }

    if (!storedRefresh) {
      updateTokens(null, null);
      setUser(null);
      return false;
    }

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });

      if (!res.ok) {
        updateTokens(null, null);
        setUser(null);
        return false;
      }

      const data: AuthResponseData = await res.json();
      updateTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return true;
    } catch (e) {
      updateTokens(null, null);
      setUser(null);
      return false;
    }
  }, [refreshToken, updateTokens]);

  // Initial session restoration on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const storedAccess = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!storedAccess && !storedRefresh) {
        if (isMounted) setIsLoading(false);
        return;
      }

      setAuthToken(storedAccess);
      setAccessTokenState(storedAccess);
      setRefreshTokenState(storedRefresh);

      // Verify access token by fetching current user profile
      if (storedAccess) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedAccess}` },
          });

          if (res.ok) {
            const userData: User = await res.json();
            if (isMounted) {
              setUser(userData);
              setIsLoading(false);
            }
            return;
          }
        } catch (e) {}
      }

      // If access token failed or was missing, attempt refresh token restoration
      if (storedRefresh) {
        const refreshed = await refreshSession();
        if (isMounted) setIsLoading(false);
        return;
      }

      if (isMounted) {
        updateTokens(null, null);
        setUser(null);
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [refreshSession, updateTokens]);

  const login = async (emailOrUsername: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data?.message || 'Login failed. Please check your credentials.' };
      }

      const authData = data as AuthResponseData;
      updateTokens(authData.accessToken, authData.refreshToken);
      setUser(authData.user);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error occurred during login.' };
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data?.message || 'Registration failed. Please check inputs.' };
      }

      const authData = data as AuthResponseData;
      updateTokens(authData.accessToken, authData.refreshToken);
      setUser(authData.user);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error occurred during registration.' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (refreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (e) {}

    updateTokens(null, null);
    setUser(null);
  };

  const openAuthModal = (view: 'login' | 'register' = 'login') => {
    setAuthModalView(view);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        authModalView,
        login,
        register,
        logout,
        refreshSession,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
