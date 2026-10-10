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
        <div className="pm-auth-form pm-auth-form--stack">
          <Link to="/lisans/dene" className="pm-btn pm-btn--primary pm-btn--block">
            7 Gün Ücretsiz Dene
          </Link>
          <Link to="/lisans/aktiflestir" className="pm-btn pm-btn--ghost pm-btn--block">
            Lisansımı Etkinleştir
          </Link>
        </div>
      </div>
    </PremiumAuthLayout>
  );
}
