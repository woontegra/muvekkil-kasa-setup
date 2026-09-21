import { useRef, useState } from "react";
import type { PremiumToastTone } from "../context/PremiumToastContext";

type ToastFn = (tone: PremiumToastTone, message: string) => void;

export function useRaporActions(showToast: ToastFn) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    showToast("info", "Rapor hazırlanıyor.");
    try {
      return await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return { busy, run };
}
