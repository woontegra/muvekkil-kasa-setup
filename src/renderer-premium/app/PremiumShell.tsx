import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { appIcon } from "../lib/brandAssets";
import { SidebarItem } from "../components/SidebarItem";
import { StatusBadge } from "../components/StatusBadge";
import { usePremiumAuth } from "../context/PremiumAuthContext";
import { usePremiumPageMeta } from "../context/PremiumPageMetaContext";
import { PremiumTcmbHeaderRates } from "../components/kurlar/PremiumTcmbHeaderRates";
import { MKD_OVERVIEW_REFRESH } from "../lib/events";
import { ofisKarsilamaAdi } from "../lib/settingsOffice";
const NAV = [
  { to: "/", label: "Genel Bakış", icon: "grid" },
  { to: "/randevular", label: "Randevular", icon: "calendar" },
  { to: "/muvekkiller", label: "Müvekkiller", icon: "users" },
  { to: "/dosyalar", label: "Dosyalar", icon: "folder" },
  { to: "/ofis-kasasi", label: "Ofis Kasası", icon: "wallet" },
  { to: "/tahsilat-merkezi", label: "Tahsilat Merkezi", icon: "receipt" },
  { to: "/icra-tahsilat", label: "İcra Tahsilat", icon: "scale" },
  { to: "/raporlar", label: "Raporlar", icon: "chart" },
  { to: "/ayarlar", label: "Ayarlar", icon: "settings" },
] as const;

const PAGE_META: Record<string, { title: string; desc: string }> = {
  "/": {
    title: "Genel Bakış",
    desc: "Ofis özeti ve güncel durum",
  },
  "/randevular": {
    title: "Randevular",
    desc: "Randevu takvimi ve planlama",
  },
  "/muvekkiller": {
    title: "Müvekkiller",
    desc: "Müvekkil kayıtları ve dosyalar",
  },
  "/dosyalar": {
    title: "Dosyalar",
    desc: "Tüm büro dosyaları",
  },
  "/ofis-kasasi": {
    title: "Ofis Kasası",
    desc: "Gelir, gider ve dönem takibi",
  },
  "/tahsilat-merkezi": {
    title: "Tahsilat Merkezi",
    desc: "Vekalet taksit tahsilat takibi",
  },
  "/icra-tahsilat": {
    title: "İcra Tahsilat",
    desc: "Alacak ve tahsilat yönetimi",
  },
  "/raporlar": {
    title: "Raporlar",
    desc: "Yazdırma ve dışa aktarma",
  },
  "/ayarlar": {
    title: "Ayarlar",
    desc: "Büro bilgileri ve program ayarları",
  },
};

function resolvePageMeta(pathname: string): { title: string; desc: string } {
  if (/^\/muvekkil\/\d+\/dosya\/\d+/.test(pathname)) {
    return { title: "Dosya detayı", desc: "Dosya kasa ve işlem kayıtları" };
  }
  if (/^\/muvekkil\/\d+/.test(pathname)) {
    return { title: "Müvekkil detayı", desc: "İletişim bilgileri ve dosyalar" };
  }
  return PAGE_META[pathname] ?? { title: "Sayfa", desc: "" };
}

function NavIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 };
  switch (name) {
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <path d="M19 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
          <path d="M16 14h.01" />
          <path d="M3 10h18" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2H4Z" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
      );
    case "scale":
      return (
        <svg {...common}>
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-3" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
  }
}

export function PremiumShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = usePremiumAuth();
  const { meta: pageMeta } = usePremiumPageMeta();
  const [collapsed, setCollapsed] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [officeLabel, setOfficeLabel] = useState("");

  const meta = useMemo(() => pageMeta ?? resolvePageMeta(location.pathname), [pageMeta, location.pathname]);

  const yukleOfisAdi = useCallback(async () => {
    try {
      const row = await window.api.officeGet();
      setOfficeLabel(ofisKarsilamaAdi(row));
    } catch {
      setOfficeLabel("");
    }
  }, []);

  const profileLabel = officeLabel || user?.adSoyad?.trim() || user?.kullaniciAdi || "Kullanıcı";

  const userInitial = useMemo(() => {
    return profileLabel.charAt(0).toLocaleUpperCase("tr-TR");
  }, [profileLabel]);

  useEffect(() => {
    void window.api?.getAppVersion?.().then(setVersion).catch(() => setVersion(null));
  }, []);

  useEffect(() => {
    void yukleOfisAdi();
  }, [yukleOfisAdi]);

  useEffect(() => {
    const onRefresh = () => void yukleOfisAdi();
    window.addEventListener(MKD_OVERVIEW_REFRESH, onRefresh);
    return () => window.removeEventListener(MKD_OVERVIEW_REFRESH, onRefresh);
  }, [yukleOfisAdi]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="pm-shell">
      <aside className={`pm-sidebar${collapsed ? " pm-sidebar--collapsed" : ""}`} aria-label="Ana menü">
        <div className="pm-sidebar-brand">
          <img src={appIcon} alt="" className="pm-sidebar-brand-icon" width={36} height={36} />
          <div className="pm-sidebar-brand-text">
            <p className="pm-sidebar-brand-title">Müvekkil Kasa</p>
            <p className="pm-sidebar-brand-sub">Premium arayüz</p>
          </div>
        </div>

        <nav className="pm-sidebar-nav">
          {NAV.map((item) => (
            <SidebarItem key={item.to} to={item.to} label={item.label} collapsed={collapsed} icon={<NavIcon name={item.icon} />} />
          ))}
        </nav>

        <div className="pm-sidebar-footer">
          <button
            type="button"
            className="pm-sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
      </aside>

      <div className="pm-main">
        <header className="pm-header">
          <div className="pm-header-left">
            <h1 className="pm-page-header-title" style={{ margin: 0, fontSize: "var(--pm-font-size-xl)" }}>
              {meta.title}
            </h1>
            <p className="pm-page-header-desc" style={{ margin: "2px 0 0", fontSize: "var(--pm-font-size-sm)" }}>
              {meta.desc}
            </p>
          </div>
          <div className="pm-header-right">
            <PremiumTcmbHeaderRates />
            {version ? <StatusBadge tone="info">v{version}</StatusBadge> : null}
            <div className="pm-header-profile" title={profileLabel}>
              <span className="pm-header-profile-avatar" aria-hidden>
                {userInitial}
              </span>
              <span className="pm-header-profile-label">{profileLabel}</span>
            </div>
            <button
              type="button"
              className="pm-header-logout-btn"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              title="Çıkış yap"
            >
              {loggingOut ? "…" : "Çıkış"}
            </button>
          </div>
        </header>

        <main className="pm-content">
          <div key={location.pathname} className="pm-content-inner pm-page-fade">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
