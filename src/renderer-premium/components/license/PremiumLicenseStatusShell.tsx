import { useEffect, useState } from "react";
import { PremiumLicenseExpiryWarningModal } from "./PremiumLicenseExpiryWarningModal";
import { usePremiumAuth } from "../../context/PremiumAuthContext";
import { usePremiumLicense } from "../../context/PremiumLicenseContext";

export function PremiumLicenseStatusShell({ children }: { children: React.ReactNode }) {
  const { needsSetup } = usePremiumAuth();
  const { offlineNotice, activeWarningDays, loading, openRenewal, dismissWarning, checkLicense } = usePremiumLicense();
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
        <div className="pm-license-offline-banner" role="status">
          {offlineNotice}
        </div>
      ) : null}
      {activeWarningDays != null && !needsSetup ? (
        <PremiumLicenseExpiryWarningModal
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

export function PremiumLicenseStatusBootstrap({ children }: { children: React.ReactNode }) {
  const { refresh } = usePremiumLicense();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <PremiumLicenseStatusShell>{children}</PremiumLicenseStatusShell>;
}
