import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { LicenseState } from "@shared/types/license";

function LicenseLockedView({ message }: { message: string | null }) {
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--enter" style={{ maxWidth: 480, margin: "10vh auto", padding: 24 }}>
        <h1 className="auth-title">Lisans kilitli</h1>
        <p className="auth-subtitle">{message ?? "Lisansınız geçerli değil."}</p>
        <p className="text-sm" style={{ marginTop: 16, color: "#64748b" }}>
          Verileriniz silinmedi. Lisans yenilendikten sonra programı yeniden başlatın veya destek ile iletişime
          geçin: info@woontegra.com
        </p>
      </div>
    </div>
  );
}

export function LicenseGateRoute() {
  const [state, setState] = useState<LicenseState | null>(null);

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

  if (!state) return null;

  if (state.locked) {
    return <LicenseLockedView message={state.message} />;
  }

  if (state.needsActivation) {
    return <Navigate to="/lisans" replace />;
  }

  return <Outlet />;
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
