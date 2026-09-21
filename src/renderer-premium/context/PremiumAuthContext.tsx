import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, SetupInput } from "@shared/types/auth";

type PremiumAuthContextValue = {
  user: AuthUser | null;
  needsSetup: boolean;
  loading: boolean;
  login: (input: { kullaniciAdi: string; password: string; rememberMe?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  setupFirst: (input: SetupInput) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const PremiumAuthContext = createContext<PremiumAuthContextValue | null>(null);

export function PremiumAuthProvider({ children }: { children: ReactNode }) {
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
    async (input: SetupInput) => {
      const r = await window.api.authSetupFirst(input);
      if (r.ok) {
        setUser(r.user ?? null);
        setNeedsSetup(false);
        return { ok: true };
      }
      return { ok: false, error: r.error };
    },
    [],
  );

  const logout = useCallback(async () => {
    await window.api.authLogout();
    setUser(null);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, needsSetup, loading, login, setupFirst, logout, refresh }),
    [user, needsSetup, loading, login, setupFirst, logout, refresh],
  );

  return <PremiumAuthContext.Provider value={value}>{children}</PremiumAuthContext.Provider>;
}

export function usePremiumAuth(): PremiumAuthContextValue {
  const ctx = useContext(PremiumAuthContext);
  if (!ctx) throw new Error("usePremiumAuth PremiumAuthProvider dışında kullanılamaz");
  return ctx;
}
