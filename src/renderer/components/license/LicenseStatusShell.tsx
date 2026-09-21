import { useEffect, useState } from "react";
import { LicenseExpiryWarningModal } from "./LicenseExpiryWarningModal";
import { useAuth } from "../../context/AuthContext";
import { useLicenseStatus } from "../../hooks/useLicenseStatus";

export function LicenseStatusShell({ children }: { children: React.ReactNode }) {
  const { needsSetup } = useAuth();
  const { offlineNotice, activeWarningDays, loading, openRenewal, dismissWarning, checkLicense } = useLicenseStatus();
  const [checkBusy, setCheckBusy] = useState(false);

  async function handleCheck() {
    setCheckBusy(true);
    try {
      await checkLicense();
    } finally {
      setCheckBusy(false);
    }
  }

  return (
    <>
      {offlineNotice ? (
        <div className="license-offline-banner" role="status">
          {offlineNotice}
        </div>
      ) : null}
      {activeWarningDays != null && !needsSetup ? (
        <LicenseExpiryWarningModal
          daysRemaining={activeWarningDays}
          busy={loading || checkBusy}
          onRenew={() => void openRenewal()}
          onDismiss={dismissWarning}
          onCheck={() => void handleCheck()}
        />
      ) : null}
      {children}
    </>
  );
}

export function LicenseStatusBootstrap({ children }: { children: React.ReactNode }) {
  const { refresh } = useLicenseStatus();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <LicenseStatusShell>{children}</LicenseStatusShell>;
}
