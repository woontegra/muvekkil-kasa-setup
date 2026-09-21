import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { LicenseState } from "@shared/types/license";
import { LicenseExpiredScreen } from "./license/LicenseExpiredScreen";
import { LicenseStatusBootstrap } from "./license/LicenseStatusShell";
import { openLicenseRenewalPage } from "../services/licenseStatusService";
import { LicenseStatusProvider } from "../hooks/useLicenseStatus";

export function LicenseGateRoute() {
  const [state, setState] = useState<LicenseState | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await window.api.licenseValidate();
      } catch {
        /* offline grace handled in main */
      }
      setState(await window.api.licenseGetState());
    })();
  }, []);

  async function handleCheckLicense() {
    setCheckBusy(true);
    try {
      await window.api.licenseValidate({ force: true });
      setState(await window.api.licenseGetState());
    } finally {
      setCheckBusy(false);
    }
  }

  if (!state) {
    return (
      <div className="auth-page" aria-busy="true" aria-live="polite">
        <div className="auth-card auth-card--enter" style={{ maxWidth: 420, margin: "12vh auto", padding: 24, textAlign: "center" }}>
          <p className="auth-subtitle" style={{ margin: 0 }}>
            Lisans durumu kontrol ediliyor…
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === "trialNetworkRequired") {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--enter" style={{ maxWidth: 420, margin: "12vh auto", padding: 24 }}>
          <h1 className="auth-title">İnternet gerekli</h1>
          <p className="auth-subtitle">{state.message ?? "Ücretsiz deneme lisansınızı doğrulamak için internet bağlantısı gereklidir."}</p>
          <button type="button" className="auth-submit" disabled={checkBusy} onClick={() => void handleCheckLicense()}>
            {checkBusy ? "Kontrol ediliyor…" : "Tekrar Dene"}
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "trialExpired" || (state.locked && state.record?.kind === "trial")) {
    return (
      <LicenseExpiredScreen
        busy={checkBusy}
        title="7 günlük ücretsiz deneme süreniz sona erdi."
        message="Kayıtlı verileriniz silinmedi. Lisansınızı etkinleştirerek aynı verilerle devam edebilirsiniz."
        renewLabel="Lisansımı Etkinleştir"
        onRenew={() => { window.location.hash = "#/lisans/aktiflestir"; }}
        onCheck={() => void handleCheckLicense()}
        onQuit={() => void window.api.appQuit()}
      />
    );
  }

  if (state.locked) {
    const expiredTitle = state.isExpired ? "Lisans süreniz sona erdi" : "Lisans doğrulanamadı";
    const expiredDefaultMessage = state.isExpired
      ? "Müvekkil Kasa Defteri programını kullanmaya devam etmek için lisansınızı yenilemeniz gerekir."
      : (state.message ?? "Lisansınız geçerli değil. Lisansı Kontrol Et ile tekrar deneyin.");

    return (
      <LicenseExpiredScreen
        busy={checkBusy}
        title={expiredTitle}
        message={state.isExpired ? state.message ?? expiredDefaultMessage : expiredDefaultMessage}
        onRenew={() => void openLicenseRenewalPage()}
        onCheck={() => void handleCheckLicense()}
        onQuit={() => void window.api.appQuit()}
      />
    );
  }

  if (state.needsActivation) {
    return <Navigate to="/lisans" replace />;
  }

  return (
    <LicenseStatusProvider>
      <LicenseStatusBootstrap>
        <Outlet />
      </LicenseStatusBootstrap>
    </LicenseStatusProvider>
  );
}

export function LicenseGuestRoute() {
  const [state, setState] = useState<LicenseState | null>(null);

  useEffect(() => {
    void window.api.licenseGetState().then(setState);
  }, []);

  if (!state) return null;

  if (state.valid && !state.needsActivation) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
