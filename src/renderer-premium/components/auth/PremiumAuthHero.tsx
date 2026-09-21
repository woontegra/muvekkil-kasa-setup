import type { CSSProperties } from "react";
import { programLogo, woontegraLogo } from "../../lib/brandAssets";

const FEATURES = [
  { label: "Müvekkil & dosya", icon: "folder" },
  { label: "Dosya kasası", icon: "wallet" },
  { label: "Vekalet taksit", icon: "calendar" },
  { label: "Tahsilat & makbuz", icon: "receipt" },
] as const;

function FeatureIcon({ name }: { name: (typeof FEATURES)[number]["icon"] }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 };
  switch (name) {
    case "folder":
      return (
        <svg {...p} aria-hidden>
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...p} aria-hidden>
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p} aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    default:
      return (
        <svg {...p} aria-hidden>
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M14 8H8M14 12H8M11 16H8" />
        </svg>
      );
  }
}

export function PremiumAuthHero() {
  return (
    <div className="pm-auth-hero" aria-hidden="false">
      <div className="pm-auth-hero-bg" aria-hidden>
        <div className="pm-auth-hero-mesh" />
        <div className="pm-auth-hero-beam pm-auth-hero-beam--1" />
        <div className="pm-auth-hero-beam pm-auth-hero-beam--2" />
        <div className="pm-auth-hero-dots" />
      </div>

      <div className="pm-auth-hero-scene" aria-hidden>
        <div className="pm-auth-float pm-auth-float--1">
          <span className="pm-auth-float-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
            </svg>
          </span>
          <span>Kasa</span>
        </div>
        <div className="pm-auth-float pm-auth-float--2">
          <span className="pm-auth-float-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
            </svg>
          </span>
          <span>Dosya</span>
        </div>
        <div className="pm-auth-float pm-auth-float--3">
          <span className="pm-auth-float-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
            </svg>
          </span>
          <span>Tahsilat</span>
        </div>
        <div className="pm-auth-float pm-auth-float--4">
          <span className="pm-auth-float-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </span>
          <span>Müvekkil</span>
        </div>
      </div>

      <div className="pm-auth-hero-content">
        <div className="pm-auth-hero-logo-wrap pm-auth-hero-logo-wrap--enter">
          <img src={programLogo} alt="Müvekkil Kasa Defteri" className="pm-auth-hero-program-logo" width={220} height={220} />
        </div>

        <h1 className="pm-auth-hero-title pm-auth-hero-title--enter">
          <span className="pm-auth-hero-title-word">Müvekkil</span>{" "}
          <span className="pm-auth-hero-title-word pm-auth-hero-title-word--2">Kasa Defteri</span>
        </h1>

        <p className="pm-auth-hero-lead pm-auth-hero-lead--enter">
          Hukuk büroları için dosya bazlı avans, masraf, vekalet ve tahsilat yönetimi — güvenli, yerel ve profesyonel.
        </p>

        <ul className="pm-auth-hero-features pm-auth-hero-features--enter">
          {FEATURES.map((f, i) => (
            <li key={f.label} className="pm-auth-hero-feature" style={{ "--pm-f-i": i } as CSSProperties}>
              <span className="pm-auth-hero-feature-icon">
                <FeatureIcon name={f.icon} />
              </span>
              {f.label}
            </li>
          ))}
        </ul>

        <div className="pm-auth-hero-woontegra pm-auth-hero-woontegra--enter">
          <img src={woontegraLogo} alt="Woontegra" className="pm-auth-hero-woontegra-logo" width={120} height={32} />
          <span>tarafından geliştirildi</span>
        </div>
      </div>
    </div>
  );
}
