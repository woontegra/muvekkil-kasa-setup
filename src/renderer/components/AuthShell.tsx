import type { ReactNode } from "react";
import programLogo from "../assets/logo-M6Wo_PDM.png";
import woontegraLogo from "../assets/woontegra-logo-C922wZYn.png";

const featureIconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function FeatureIconClientFiles() {
  return (
    <svg {...featureIconProps} aria-hidden>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
      <circle cx="12" cy="11" r="2" />
      <path d="M12 9V8" />
    </svg>
  );
}

function FeatureIconWallet() {
  return (
    <svg {...featureIconProps} aria-hidden>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function FeatureIconInstallments() {
  return (
    <svg {...featureIconProps} aria-hidden>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h8" />
      <path d="M8 18h5" />
    </svg>
  );
}

function FeatureIconReceipt() {
  return (
    <svg {...featureIconProps} aria-hidden>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6" />
      <path d="M16 12h-6" />
      <path d="M13 16h-3" />
    </svg>
  );
}

const FEATURES = [
  { t: "Müvekkil ve dosya yönetimi", icon: <FeatureIconClientFiles /> },
  { t: "Dosya kasası ve masraf takibi", icon: <FeatureIconWallet /> },
  { t: "Vekalet taksit yönetimi", icon: <FeatureIconInstallments /> },
  { t: "Makbuz ve hesap özeti", icon: <FeatureIconReceipt /> },
];

type Props = {
  card: ReactNode;
  variant?: "default" | "setup";
};

export function AuthShell({ card, variant = "default" }: Props) {
  const setup = variant === "setup";
  return (
    <div className={setup ? "auth-page auth-page--setup" : "auth-page"}>
      <div className="auth-bg" aria-hidden>
        <div className="auth-bg-gradient" />
        <div className="auth-bg-grid" />
        <div className="auth-bg-orb auth-bg-orb--1" />
        <div className="auth-bg-orb auth-bg-orb--2" />
      </div>
      <div className={setup ? "auth-layout auth-layout--setup" : "auth-layout"}>
        <section className="auth-hero" aria-labelledby="auth-hero-title">
          <h1 id="auth-hero-title" className="auth-hero-sr-only">
            Müvekkil Kasa Defteri
          </h1>
          <div className="auth-hero-badge">
            <span className="auth-hero-badge-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            Yerel · çevrimdışı
          </div>
          <div className="auth-hero-brand">
            <img src={programLogo} alt="" className="auth-hero-logo" />
          </div>
          <p className="auth-hero-lead">Dosya bazlı avans, masraf ve vekalet takibini düzenli yönetin.</p>
          <ul className="auth-feature-list">
            {FEATURES.map((f) => (
              <li key={f.t} className="auth-feature-item">
                <span className="auth-feature-ico" aria-hidden>
                  {f.icon}
                </span>
                <span>{f.t}</span>
              </li>
            ))}
          </ul>
          <div className="auth-hero-woontegra-footer">
            <img src={woontegraLogo} alt="Woontegra" className="auth-hero-woontegra-mark" />
            <span className="auth-hero-woontegra-text">tarafından geliştirildi</span>
          </div>
        </section>
        <div className="auth-card-wrap">{card}</div>
      </div>
    </div>
  );
}
