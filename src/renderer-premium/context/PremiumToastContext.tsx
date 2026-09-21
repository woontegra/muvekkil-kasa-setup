import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type PremiumToastTone = "success" | "error" | "warning" | "info";

export type PremiumToastItem = {
  id: string;
  tone: PremiumToastTone;
  message: string;
};

type PremiumToastContextValue = {
  toasts: PremiumToastItem[];
  showToast: (tone: PremiumToastTone, message: string) => void;
  dismissToast: (id: string) => void;
};

const PremiumToastContext = createContext<PremiumToastContextValue | null>(null);

const DEDUP_MS = 2000;
const DURATION: Record<PremiumToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 7000,
};

let toastSeq = 0;

export function PremiumToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<PremiumToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const lastRef = useRef<{ message: string; at: number } | null>(null);

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (tone: PremiumToastTone, message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const now = Date.now();
      if (lastRef.current?.message === trimmed && now - lastRef.current.at < DEDUP_MS) {
        return;
      }
      lastRef.current = { message: trimmed, at: now };

      const id = `pm-toast-${++toastSeq}`;
      setToasts((prev) => [...prev, { id, tone, message: trimmed }]);

      const timer = window.setTimeout(() => dismissToast(id), DURATION[tone]);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast]);

  return <PremiumToastContext.Provider value={value}>{children}</PremiumToastContext.Provider>;
}

export function usePremiumToast(): PremiumToastContextValue {
  const ctx = useContext(PremiumToastContext);
  if (!ctx) throw new Error("usePremiumToast PremiumToastProvider dışında kullanılamaz");
  return ctx;
}
