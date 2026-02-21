"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@/types";
import { getToken, setToken, clearToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = getToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setTokenState(storedToken);

    apiFetch<User>("/api/user/me")
      .then((fetchedUser) => {
        setUser(fetchedUser);
      })
      .catch(() => {
        clearToken();
        setTokenState(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fetchedUser = await apiFetch<User>("/api/user/me");
      setUser(fetchedUser);
    } catch {
      // silent — stale credits are non-critical
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
