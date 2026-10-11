import { Link } from "react-router-dom";

type Props = {
  licenseBusy: boolean;
  onNewMuvekkil: () => void;
  onLicenseCheck: () => void;
};

export function DashboardQuickActions({ licenseBusy, onNewMuvekkil, onLicenseCheck }: Props) {
  return (
    <section className="pm-overview-panel pm-quick-panel pm-dash-side-card" aria-label="Hızlı işlemler">
      <h2 className="pm-overview-panel-title">Hızlı işlemler</h2>
      <div className="pm-quick-actions">
        <button type="button" className="pm-quick-action" onClick={onNewMuvekkil}>
          <span className="pm-quick-action-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          Yeni müvekkil
        </button>
        <Link to="/ofis-kasasi" className="pm-quick-action">
          <span className="pm-quick-action-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M19 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
              <path d="M16 14h.01M3 10h18" />
            </svg>
          </span>
          Ofis Kasası
        </Link>
        <Link to="/icra-tahsilat" className="pm-quick-action">
          <span className="pm-quick-action-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10M12 3v18" />
            </svg>
          </span>
          İcra Tahsilat
        </Link>
        <Link to="/raporlar" className="pm-quick-action">
          <span className="pm-quick-action-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M4 19V5M4 19h16M8 15v4M12 11v8M16 7v12" />
            </svg>
          </span>
          Raporlar
        </Link>
      </div>

      <button
        type="button"
        className="pm-dash-license-btn"
        onClick={onLicenseCheck}
        disabled={licenseBusy}
      >
        <span className="pm-dash-license-icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          </svg>
        </span>
        {licenseBusy ? "Kontrol ediliyor…" : "Lisansı kontrol et"}
      </button>
    </section>
  );
}
