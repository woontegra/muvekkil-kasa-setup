import { Link } from "react-router-dom";
import type { TahsilatMerkeziOzet } from "@shared/types/tahsilatMerkezi";

type Props = {
  ozet: TahsilatMerkeziOzet | null;
  loading: boolean;
};

export function DashboardTahsilatPanel({ ozet, loading }: Props) {
  return (
    <section className="pm-overview-panel pm-tahsilat-side pm-dash-side-card" aria-label="Tahsilat Merkezi özeti">
      <div className="pm-overview-panel-head">
        <h3 className="pm-overview-panel-title">Tahsilat Merkezi</h3>
        <Link to="/tahsilat-merkezi" className="pm-btn pm-btn--sm pm-btn--ghost">
          Aç
        </Link>
      </div>
      <div className="pm-tahsilat-side-grid">
        {loading && !ozet ? (
          <p className="pm-muted">Yükleniyor…</p>
        ) : (
          <>
            <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--danger">
              <span className="pm-tahsilat-side-label">Gecikmiş</span>
              <strong className="pm-tahsilat-side-value">{ozet?.gecikmisAdet ?? 0}</strong>
            </div>
            <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--pending">
              <span className="pm-tahsilat-side-label">Bugün</span>
              <strong className="pm-tahsilat-side-value">{ozet?.bugunAdet ?? 0}</strong>
            </div>
            <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--info">
              <span className="pm-tahsilat-side-label">7 gün</span>
              <strong className="pm-tahsilat-side-value">{ozet?.yakin7GunAdet ?? 0}</strong>
            </div>
            <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--neutral">
              <span className="pm-tahsilat-side-label">Kısmi</span>
              <strong className="pm-tahsilat-side-value">{ozet?.kismiAdet ?? 0}</strong>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
