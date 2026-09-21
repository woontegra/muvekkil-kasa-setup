import { Link } from "react-router-dom";
import { PremiumAuthLayout } from "../../components/auth/PremiumAuthLayout";

export function LicenseChoicePage() {
  return (
    <PremiumAuthLayout>
      <div className="pm-auth-card pm-auth-card--enter">
        <h2 className="pm-auth-card-title">Müvekkil Kasası</h2>
        <p className="pm-auth-card-sub">Masaüstü</p>
        <p className="pm-auth-card-sub">
          7 gün ücretsiz deneyin veya satın aldığınız lisansı etkinleştirin.
        </p>
        <div className="pm-auth-form" style={{ gap: 12 }}>
          <Link to="/lisans/dene" className="pm-btn pm-btn--primary" style={{ textAlign: "center" }}>
            7 Gün Ücretsiz Dene
          </Link>
          <Link to="/lisans/aktiflestir" className="pm-btn pm-btn--ghost" style={{ textAlign: "center" }}>
            Lisansımı Etkinleştir
          </Link>
        </div>
      </div>
    </PremiumAuthLayout>
  );
}
