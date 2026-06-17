import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@shared/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  needsSetup: boolean;
  loading: boolean;
  login: (input: { kullaniciAdi: string; password: string; rememberMe?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  setupFirst: (input: {
    adSoyad: string;
    kullaniciAdi: string;
    sifre: string;
    guvenlikSorusuKodu: string;
    guvenlikCevabi: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [setup, session] = await Promise.all([
      window.api.authNeedsSetup(),
      window.api.authGetSession(),
    ]);
    setNeedsSetup(Boolean(setup));
    setUser(session);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = useCallback(async (input: { kullaniciAdi: string; password: string; rememberMe?: boolean }) => {
    const r = await window.api.authLogin(input);
    if (r.ok) {
      setUser(r.user ?? null);
      setNeedsSetup(false);
      return { ok: true };
    }
    return { ok: false, error: r.error };
  }, []);

  const setupFirst = useCallback(
    async (input: {
      adSoyad: string;
      kullaniciAdi: string;
      sifre: string;
      guvenlikSorusuKodu: string;
      guvenlikCevabi: string;
    }) => {
      const r = await window.api.authSetupFirst(input);
      if (r.ok) {
        setUser(r.user ?? null);
        setNeedsSetup(false);
        return { ok: true };
      }
      return { ok: false, error: r.error };
    },
    []
  );

  const logout = useCallback(async () => {
    await window.api.authLogout();
    setUser(null);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, needsSetup, loading, login, setupFirst, logout, refresh }),
    [user, needsSetup, loading, login, setupFirst, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider dışında kullanılamaz");
  return ctx;
}
