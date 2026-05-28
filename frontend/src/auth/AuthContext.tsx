import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const TOKEN_KEY = "myra_jwt";

export type AppUser = {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  state_code?: string | null;
};

type AuthState = { loading: boolean; user: AppUser | null; token: string | null };

type Ctx = AuthState & {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, name: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserLocal: (updater: (u: AppUser | null) => AppUser | null) => void;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") return await storage.getItem<string>(TOKEN_KEY, "");
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

async function writeToken(t: string | null) {
  if (!t) {
    if (Platform.OS === "web") await storage.removeItem(TOKEN_KEY);
    else await storage.secureRemove(TOKEN_KEY);
    return;
  }
  if (Platform.OS === "web") await storage.setItem(TOKEN_KEY, t);
  else await storage.secureSet(TOKEN_KEY, t);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, token: null });

  const fetchMe = useCallback(async (token: string): Promise<AppUser | null> => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data.user as AppUser;
    } catch {
      return null;
    }
  }, []);

  const handleAuthResult = useCallback(async (r: Response): Promise<{ ok: boolean; error?: string }> => {
    if (!r.ok) {
      let msg = "Hiba történt.";
      try {
        const d = await r.json();
        if (typeof d?.detail === "string") msg = d.detail;
        else if (Array.isArray(d?.detail) && d.detail.length > 0) {
          // Pydantic 422 validation error — detail is an array of objects
          msg = d.detail[0]?.msg || "Érvénytelen adat.";
        } else if (d?.detail) {
          msg = String(d.detail);
        }
      } catch {}
      return { ok: false, error: msg };
    }
    const data = await r.json();
    const token: string = data.access_token;
    const user: AppUser = data.user;
    await writeToken(token);
    setState({ loading: false, user, token });
    return { ok: true };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleAuthResult(r);
  }, [handleAuthResult]);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const r = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    return handleAuthResult(r);
  }, [handleAuthResult]);

  const logout = useCallback(async () => {
    try {
      if (state.token) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${state.token}` },
        });
      }
    } catch {}
    await writeToken(null);
    setState({ loading: false, user: null, token: null });
  }, [state.token]);

  const refreshUser = useCallback(async () => {
    if (!state.token) return;
    const u = await fetchMe(state.token);
    if (u) setState((s) => ({ ...s, user: u }));
  }, [state.token, fetchMe]);

  const setUserLocal = useCallback((updater: (u: AppUser | null) => AppUser | null) => {
    setState((s) => ({ ...s, user: updater(s.user) }));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await readToken();
      if (!token) { if (mounted) setState({ loading: false, user: null, token: null }); return; }
      const u = await fetchMe(token);
      if (!u) {
        await writeToken(null);
        if (mounted) setState({ loading: false, user: null, token: null });
        return;
      }
      if (mounted) setState({ loading: false, user: u, token });
    })();
    return () => { mounted = false; };
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, setUserLocal }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function apiUrl(path: string) {
  return `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function authedFetch(token: string | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return await fetch(apiUrl(path), { ...init, headers });
}
