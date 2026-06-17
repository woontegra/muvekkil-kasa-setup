import type { ReactNode } from "react";
import programLogo from "../assets/logo-M6Wo_PDM.png";
import woontegraLogo from "../assets/woontegra-logo-C922wZYn.png";

const FEATURES = [
  { t: "Müvekkil ve dosya yönetimi", i: "M" },
  { t: "Dosya kasası ve masraf takibi", i: "K" },
  { t: "Vekalet taksit yönetimi", i: "V" },
  { t: "Makbuz ve hesap özeti", i: "H" },
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
                  {f.i}
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
