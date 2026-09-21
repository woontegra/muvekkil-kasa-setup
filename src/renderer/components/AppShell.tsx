import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LicenseStatusBadge } from "./license/LicenseStatusBadge";
import { BrowserPreviewBanner } from "./BrowserPreviewBanner";
import { LegacyTcmbHeaderRates } from "./kurlar/LegacyTcmbHeaderRates";
import appIcon from "../assets/app-icon-DS-8UBWS.png";

export function AppShell() {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const hideChrome = loc.pathname.startsWith("/print/");

  return (
    <div className="app-shell">
      <BrowserPreviewBanner />
      {!hideChrome ? (
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-header-brand-col">
              <div className="app-header-brand">
                <Link to="/" className="app-title-link app-header-title-row">
                  <img src={appIcon} alt="" className="app-header-mark-img" width={24} height={24} />
                  <div className="app-header-title-stack">
                    <h1>Müvekkil Kasa Defteri</h1>
                    <p className="tagline">Dosya bazlı avans ve masraf takibi</p>
                  </div>
                </Link>
              </div>
            </div>
            <nav className="app-header-nav-col" aria-label="Ana gezinme">
              <Link to="/" className={loc.pathname === "/" ? "nav-link nav-link--active" : "nav-link"}>
                Müvekkil Kasa
              </Link>
              <Link
                to="/dosyalar"
                className={loc.pathname.startsWith("/dosyalar") ? "nav-link nav-link--active" : "nav-link"}
              >
                Dosyalar
              </Link>
              <Link
                to="/ofis-kasasi"
                className={loc.pathname.startsWith("/ofis-kasasi") ? "nav-link nav-link--active" : "nav-link"}
              >
                Ofis kasası
              </Link>
              <Link
                to="/tahsilat-merkezi"
                className={loc.pathname.startsWith("/tahsilat-merkezi") ? "nav-link nav-link--active" : "nav-link"}
              >
                Tahsilat
              </Link>
              <Link
                to="/icra-tahsilat"
                className={loc.pathname.startsWith("/icra-tahsilat") ? "nav-link nav-link--active" : "nav-link"}
              >
                İcra tahsilat
              </Link>
              <Link
                to="/randevular"
                className={loc.pathname.startsWith("/randevular") ? "nav-link nav-link--active" : "nav-link"}
              >
                Randevu
              </Link>
              <Link
                to="/raporlar"
                className={loc.pathname.startsWith("/raporlar") ? "nav-link nav-link--active" : "nav-link"}
              >
                Raporlar
              </Link>
              <Link
                to="/ayarlar/ofis"
                className={loc.pathname.startsWith("/ayarlar") ? "nav-link nav-link--active" : "nav-link"}
              >
                Ofis bilgileri
              </Link>
            </nav>
            <div className="app-header-user-col" aria-label="Oturum">
              <LegacyTcmbHeaderRates />
              <LicenseStatusBadge />
              <span className="app-header-user-label" title={user?.kullaniciAdi ?? ""}>
                {user?.adSoyad?.trim() || user?.kullaniciAdi}
              </span>
              <button type="button" className="btn btn-outline-primary btn--header-logout" onClick={() => void logout()}>
                Çıkış Yap
              </button>
            </div>
          </div>
        </header>
      ) : null}
      <main className={hideChrome ? "app-main app-main--print" : "app-main"}>
        <Outlet />
      </main>
    </div>
  );
}
