import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LicenseState, LicenseValidateResult } from "@shared/types/license";
import { DESKTOP_LICENSE_UPDATED_EVENT, isPaidRenewalReminderEligible } from "@shared/lib/licenseExpiry";
import {
  markExpiryWarningShown,
  openLicenseRenewalPage,
  shouldShowExpiryWarning,
} from "../services/licenseStatusService";

type PremiumLicenseContextValue = {
  state: LicenseState | null;
  loading: boolean;
  offlineNotice: string | null;
  refresh: () => Promise<LicenseState | null>;
  checkLicense: () => Promise<LicenseValidateResult>;
  openRenewal: () => Promise<void>;
  quitApp: () => Promise<void>;
  activeWarningDays: number | null;
  dismissWarning: () => void;
};

const PremiumLicenseContext = createContext<PremiumLicenseContextValue | null>(null);

export function PremiumLicenseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [activeWarningDays, setActiveWarningDays] = useState<number | null>(null);

  const applyState = useCallback((next: LicenseState, validateMessage?: string | null, offlineDegraded?: boolean) => {
    setState(next);
    if (offlineDegraded) {
      setOfflineNotice(validateMessage ?? "Lisans sunucusuna ulaşılamadı. Son doğrulama bilgisiyle devam ediyorsunuz.");
    } else {
      setOfflineNotice(null);
    }

    if (
      isPaidRenewalReminderEligible({
        valid: next.valid,
        kind: next.record?.kind,
        warningThreshold: next.warningThreshold,
      }) &&
      next.warningThreshold != null &&
      shouldShowExpiryWarning(next.warningThreshold)
    ) {
      setActiveWarningDays(next.daysRemaining ?? next.warningThreshold);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await window.api.licenseGetState();
      applyState(next, next.message, next.offlineDegraded);
      return next;
    } finally {
      setLoading(false);
    }
  }, [applyState]);

  const checkLicense = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.licenseValidate({ force: true });
      const next = await window.api.licenseGetState();
      if (result.ok) {
        applyState(next, result.message, result.offlineDegraded);
        if (next.valid) setActiveWarningDays(null);
      } else {
        setState(next);
        setOfflineNotice(null);
        setActiveWarningDays(null);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [applyState]);

  useEffect(() => {
    const onUpdated = () => {
      void refresh();
    };
    window.addEventListener(DESKTOP_LICENSE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(DESKTOP_LICENSE_UPDATED_EVENT, onUpdated);
  }, [refresh]);

  const openRenewal = useCallback(() => openLicenseRenewalPage(), []);
  const quitApp = useCallback(() => window.api.appQuit(), []);

  const dismissWarning = useCallback(() => {
    if (state?.warningThreshold != null) {
      markExpiryWarningShown(state.warningThreshold);
    }
    setActiveWarningDays(null);
  }, [state?.warningThreshold]);

  const value = useMemo(
    () => ({
      state,
      loading,
      offlineNotice,
      refresh,
      checkLicense,
      openRenewal,
      quitApp,
      activeWarningDays,
      dismissWarning,
    }),
    [state, loading, offlineNotice, refresh, checkLicense, openRenewal, quitApp, activeWarningDays, dismissWarning],
  );

  return <PremiumLicenseContext.Provider value={value}>{children}</PremiumLicenseContext.Provider>;
}

export function usePremiumLicense(): PremiumLicenseContextValue {
  const ctx = useContext(PremiumLicenseContext);
  if (!ctx) {
    throw new Error("usePremiumLicense yalnızca PremiumLicenseProvider içinde kullanılabilir.");
  }
  return ctx;
}
