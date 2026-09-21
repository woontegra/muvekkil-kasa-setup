import { Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";

export function LicenseChoicePage() {
  return (
    <AuthShell
      card={
        <div className="auth-card auth-card--enter">
          <h1 className="auth-title">Müvekkil Kasası</h1>
          <p className="auth-subtitle">Masaüstü — 7 gün ücretsiz deneyin veya lisansınızı etkinleştirin.</p>
          <div className="auth-form">
            <Link to="/lisans/dene" className="auth-submit" style={{ display: "block", textAlign: "center" }}>
              7 Gün Ücretsiz Dene
            </Link>
            <Link to="/lisans/aktiflestir" className="btn btn-outline-primary" style={{ display: "block", textAlign: "center" }}>
              Lisansımı Etkinleştir
            </Link>
          </div>
        </div>
      }
    />
  );
}
