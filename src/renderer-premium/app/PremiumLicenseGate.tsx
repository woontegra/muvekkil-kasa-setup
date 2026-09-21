import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import type { LicenseState } from "@shared/types/license";
import { PremiumLicenseExpiredScreen } from "../components/license/PremiumLicenseExpiredScreen";
import { PremiumLicenseStatusBootstrap } from "../components/license/PremiumLicenseStatusShell";
import { PremiumLoadingScreen } from "../components/auth/PremiumLoadingScreen";
import { openLicenseRenewalPage } from "../services/licenseStatusService";
import { PremiumLicenseProvider } from "../context/PremiumLicenseContext";
import { PremiumAuthLayout } from "../components/auth/PremiumAuthLayout";
import { PremiumButton } from "../components/PremiumButton";

export function PremiumLicenseGate() {
  const [state, setState] = useState<LicenseState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const navigate = useNavigate();

  const loadLicenseState = useCallback(async () => {
    setLoadError(null);
    try {
      try {
        await window.api.licenseValidate();
      } catch {
        /* offline / trial network handled in main */
      }
      setState(await window.api.licenseGetState());
    } catch {
      setLoadError("Lisans durumu okunamadı.");
      setState(null);
    }
  }, []);

  useEffect(() => {
    void loadLicenseState();
  }, [loadLicenseState]);

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
    if (loadError) {
      return (
        <div className="pm-auth-page pm-auth-page--loading">
          <div className="pm-auth-card" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
            <p style={{ margin: "0 0 16px", color: "var(--pm-text-secondary)" }}>{loadError}</p>
            <button type="button" className="pm-btn pm-btn--primary" onClick={() => void loadLicenseState()}>
              Yeniden dene
            </button>
          </div>
        </div>
      );
    }
    return <PremiumLoadingScreen message="Lisans durumu kontrol ediliyor…" />;
  }

  if (state.phase === "trialNetworkRequired") {
    return (
      <PremiumAuthLayout>
        <div className="pm-auth-card pm-auth-card--enter">
          <h2 className="pm-auth-card-title">İnternet gerekli</h2>
          <p className="pm-auth-card-sub">
            {state.message ?? "Ücretsiz deneme lisansınızı doğrulamak için internet bağlantısı gereklidir."}
          </p>
          <PremiumButton type="button" className="pm-auth-submit" disabled={checkBusy} onClick={() => void handleCheckLicense()}>
            {checkBusy ? "Kontrol ediliyor…" : "Tekrar Dene"}
          </PremiumButton>
        </div>
      </PremiumAuthLayout>
    );
  }

  if (state.phase === "trialExpired" || (state.locked && state.record?.kind === "trial")) {
    return (
      <PremiumLicenseExpiredScreen
        busy={checkBusy}
        title="7 günlük ücretsiz deneme süreniz sona erdi."
        message="Kayıtlı verileriniz silinmedi. Lisansınızı etkinleştirerek aynı verilerle devam edebilirsiniz."
        renewLabel="Lisansımı Etkinleştir"
        onRenew={() => navigate("/lisans/aktiflestir")}
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
      <PremiumLicenseExpiredScreen
        busy={checkBusy}
        title={expiredTitle}
        message={state.isExpired ? (state.message ?? expiredDefaultMessage) : expiredDefaultMessage}
        onRenew={() => void openLicenseRenewalPage()}
        onCheck={() => void handleCheckLicense()}
        onQuit={() => void window.api.appQuit()}
      />
    );
  }

  if (state.needsActivation || state.phase === "needsActivation") {
    return <Navigate to="/lisans" replace />;
  }

  return (
    <PremiumLicenseProvider>
      <PremiumLicenseStatusBootstrap>
        <Outlet />
      </PremiumLicenseStatusBootstrap>
    </PremiumLicenseProvider>
  );
}

export function PremiumLicenseGuestRoute() {
  const [state, setState] = useState<LicenseState | null>(null);

  useEffect(() => {
    void window.api.licenseGetState().then(setState);
  }, []);

  if (!state) return <PremiumLoadingScreen message="Lisans durumu kontrol ediliyor…" />;

  if (state.valid && !state.needsActivation) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
