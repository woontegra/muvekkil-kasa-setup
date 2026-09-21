import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UpdateStatusSnapshot } from "@shared/types/update";

type UpdateStatusContextValue = {
  status: UpdateStatusSnapshot | null;
  refresh: () => Promise<void>;
};

const UpdateStatusContext = createContext<UpdateStatusContextValue | null>(null);

export function UpdateStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatusSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await window.api.updateGetStatus();
      setStatus(s);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void refresh();
    unsub = window.api.onUpdateStatusChanged((next) => setStatus(next));
    return () => {
      unsub?.();
    };
  }, [refresh]);

  const value = useMemo(() => ({ status, refresh }), [status, refresh]);

  return <UpdateStatusContext.Provider value={value}>{children}</UpdateStatusContext.Provider>;
}

export function useUpdateStatus(): UpdateStatusContextValue {
  const ctx = useContext(UpdateStatusContext);
  if (!ctx) {
    throw new Error("useUpdateStatus yalnızca UpdateStatusProvider içinde kullanılabilir.");
  }
  return ctx;
}
