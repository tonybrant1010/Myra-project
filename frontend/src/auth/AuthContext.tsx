import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

function backendUrl() {
  return (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
}
const TOKEN_KEY = "myra_jwt";
const DEVICE_TOKEN_KEY = "myra_trusted_device";

export type AppUser = {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  state_code?: string | null;
  mfa_enabled?: boolean;
  mfa_forced?: boolean;
  is_code_expired?: boolean;
  code_days_remaining?: number;
};

type AuthState = { loading: boolean; user: AppUser | null; token: string | null };
export type AuthResult = {
  ok: boolean;
  error?: string;
  mfaRequired?: boolean;
  challengeId?: string;
  isAdmin?: boolean;
  detail?: string;
};

type Ctx = AuthState & {
  login: (email: string, password: string) => Promise<AuthResult>;
  verifyMfa: (challengeId: string, code: string, rememberDevice: boolean) => Promise<AuthResult>;
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

async function readDeviceToken(): Promise<string | null> {
  if (Platform.OS === "web") return await storage.getItem<string>(DEVICE_TOKEN_KEY, "");
  return await storage.secureGet<string>(DEVICE_TOKEN_KEY, "");
}

async function writeDeviceToken(t: string | null) {
  if (!t) {
    if (Platform.OS === "web") await storage.removeItem(DEVICE_TOKEN_KEY);
    else await storage.secureRemove(DEVICE_TOKEN_KEY);
    return;
  }
  if (Platform.OS === "web") await storage.setItem(DEVICE_TOKEN_KEY, t);
  else await storage.secureSet(DEVICE_TOKEN_KEY, t);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, token: null });

  const fetchMe = useCallback(async (token: string): Promise<AppUser | null> => {
    try {
      const r = await fetch(apiUrl("/api/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data.user as AppUser;
    } catch {
      return null;
    }
  }, []);

  const handleAuthResult = useCallback(async (r: Response): Promise<AuthResult> => {
    if (!r.ok) {
      let msg = "Hiba történt.";
      try {
        const d = await r.json();
        if (typeof d?.detail === "string") msg = d.detail;
        else if (Array.isArray(d?.detail) && d.detail.length > 0) {
          msg = d.detail[0]?.msg || "Érvénytelen adat.";
        } else if (d?.detail) {
          msg = String(d.detail);
        }
      } catch {}
      return { ok: false, error: msg };
    }

    const data = await r.json();
    if (data?.mfa_required) {
      return {
        ok: false,
        mfaRequired: true,
        challengeId: data.challenge_id,
        isAdmin: !!data.is_admin,
        detail: data.detail || "Biztonsági kód szükséges.",
      };
    }

    const token: string = data.access_token;
    const user: AppUser = data.user;
    if (data.device_token) await writeDeviceToken(data.device_token);
    await writeToken(token);
    setState({ loading: false, user, token });
    return { ok: true };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const deviceToken = await readDeviceToken();
    const r = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, device_token: deviceToken || undefined }),
    });
    return handleAuthResult(r);
  }, [handleAuthResult]);

  const verifyMfa = useCallback(async (challengeId: string, code: string, rememberDevice: boolean) => {
    const r = await fetch(apiUrl("/api/auth/mfa/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_id: challengeId, code, remember_device: rememberDevice }),
    });
    return handleAuthResult(r);
  }, [handleAuthResult]);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const r = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    return handleAuthResult(r);
  }, [handleAuthResult]);

  const logout = useCallback(async () => {
    try {
      if (state.token) {
        await fetch(apiUrl("/api/auth/logout"), {
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
      if (!token) {
        if (mounted) setState({ loading: false, user: null, token: null });
        return;
      }
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
    <AuthContext.Provider value={{ ...state, login, verifyMfa, register, logout, refreshUser, setUserLocal }}>
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
  const cleanPath = path.trim();
  return `${backendUrl()}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
}

export async function authedFetch(token: string | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return await fetch(apiUrl(path), { ...init, headers });
}
