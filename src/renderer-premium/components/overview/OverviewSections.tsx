import { Link } from "react-router-dom";
import type { MuvekkilListItem } from "@shared/types/muvekkil";
import type { VekaletTaksitUyariSatir } from "@shared/types/vekalet";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";
import { MuvekkilListPanel } from "../muvekkil/MuvekkilListPanel";
import { formatDateTr, formatTry } from "../../lib/format";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { taksitDurumEtiket, taksitDurumTone } from "../../lib/vekalet";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";

function DonemSegmentedSwitch({
  mode,
  busy,
  onChange,
}: {
  mode: AccountingPeriodMode;
  busy?: boolean;
  onChange: (mode: AccountingPeriodMode) => void;
}) {
  return (
    <div className="pm-period-switch" role="radiogroup" aria-label="Hesap dönemi">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "MONTHLY"}
        className={`pm-period-switch-btn${mode === "MONTHLY" ? " pm-period-switch-btn--active" : ""}`}
        disabled={busy}
        onClick={() => onChange("MONTHLY")}
      >
        Aylık
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "YEARLY"}
        className={`pm-period-switch-btn${mode === "YEARLY" ? " pm-period-switch-btn--active" : ""}`}
        disabled={busy}
        onClick={() => onChange("YEARLY")}
      >
        Yıllık
      </button>
    </div>
  );
}

type MuvekkilTableProps = {
  items: MuvekkilListItem[];
  loading: boolean;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  query: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onNewMuvekkil: () => void;
  onQueryChange: (q: string) => void;
  error?: string | null;
  onRetry?: () => void;
};

export function MuvekkilTableSection(props: MuvekkilTableProps) {
  return <MuvekkilListPanel {...props} variant="overview" />;
}

type AlertsProps = {
  vadesiGecmis: number;
  bugunOdenecek: number;
  odenmemis: number;
  smmBekleyen: number;
  vadesiGecmisListe: VekaletTaksitUyariSatir[];
  loading?: boolean;
};

export function AlertsPanel({
  vadesiGecmis,
  bugunOdenecek,
  odenmemis,
  smmBekleyen,
  vadesiGecmisListe,
  loading,
}: AlertsProps) {
  return (
    <section className="pm-overview-panel pm-alerts-panel" aria-label="Taksit ve SMM uyarıları">
      <h2 className="pm-overview-panel-title">Uyarı merkezi</h2>
      <div className="pm-alert-metrics">
        <div className={`pm-alert-metric pm-alert-metric--danger${vadesiGecmis > 0 ? " pm-alert-metric--pulse" : ""}`}>
          <span className="pm-alert-metric-label">Vadesi geçmiş</span>
          <span className="pm-alert-metric-value">{loading ? "…" : vadesiGecmis}</span>
        </div>
        <div className="pm-alert-metric pm-alert-metric--warning">
          <span className="pm-alert-metric-label">Bugün ödenecek</span>
          <span className="pm-alert-metric-value">{loading ? "…" : bugunOdenecek}</span>
        </div>
        <div className="pm-alert-metric pm-alert-metric--info">
          <span className="pm-alert-metric-label">Ödenmemiş</span>
          <span className="pm-alert-metric-value">{loading ? "…" : odenmemis}</span>
        </div>
        <div className="pm-alert-metric pm-alert-metric--smm">
          <span className="pm-alert-metric-label">SMM bekleyen</span>
          <span className="pm-alert-metric-value">{loading ? "…" : smmBekleyen}</span>
        </div>
      </div>

      <h3 className="pm-alerts-subtitle">Vadesi geçmiş taksitler</h3>
      <div className="pm-alerts-table-wrap">
        {loading ? (
          <div className="pm-mvk-skeleton-list" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="pm-skeleton pm-skeleton--row" />
            ))}
          </div>
        ) : vadesiGecmisListe.length === 0 ? (
          <EmptyState title="Vadesi geçmiş taksit yok" description="Tüm taksitler güncel görünüyor." />
        ) : (
          <table className="pm-alerts-table">
            <thead>
              <tr>
                <th>Müvekkil</th>
                <th>Dosya</th>
                <th>Vade</th>
                <th>Kalan</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vadesiGecmisListe.map((t) => (
                <tr key={t.taksitId}>
                  <td className="pm-mvk-cell-ellipsis" title={t.muvekkilAdi}>
                    {t.muvekkilAdi}
                  </td>
                  <td className="pm-mvk-cell-ellipsis" title={t.dosyaKonu}>
                    {t.dosyaKonu}
                  </td>
                  <td>{formatDateTr(t.vadeTarihi)}</td>
                  <td className="pm-mvk-cell-money">{formatTry(t.kalan)}</td>
                  <td>
                    <StatusBadge tone={taksitDurumTone(t.durum)}>{taksitDurumEtiket(t.durum)}</StatusBadge>
                  </td>
                  <td>
                    <Link to={`/muvekkil/${t.muvekkilId}/dosya/${t.dosyaId}`} className="pm-mvk-detail-link">
                      Aç
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

type QuickProps = {
  donemMode: import("@shared/types/accountingPeriod").AccountingPeriodMode;
  donemBusy: boolean;
  licenseBusy: boolean;
  onNewMuvekkil: () => void;
  onDonemChange: (mode: import("@shared/types/accountingPeriod").AccountingPeriodMode) => void;
  onLicenseCheck: () => void;
};

export function QuickActionsPanel({
  donemMode,
  donemBusy,
  licenseBusy,
  onNewMuvekkil,
  onDonemChange,
  onLicenseCheck,
}: QuickProps) {
  return (
    <section className="pm-overview-panel pm-quick-panel" aria-label="Hızlı işlemler">
      <h2 className="pm-overview-panel-title">Hızlı işlemler</h2>
      <div className="pm-quick-actions">
        <button type="button" className="pm-quick-action" onClick={onNewMuvekkil}>
          <span className="pm-quick-action-icon" aria-hidden>+</span>
          Yeni müvekkil
        </button>
        <Link to="/ofis-kasasi" className="pm-quick-action">
          <span className="pm-quick-action-icon" aria-hidden>₺</span>
          Ofis Kasası
        </Link>
        <Link to="/icra-tahsilat" className="pm-quick-action">
          <span className="pm-quick-action-icon" aria-hidden>⚖</span>
          İcra Tahsilat
        </Link>
        <div className="pm-quick-action pm-quick-action--donem">
          <span className="pm-quick-action-label">Hesap dönemi</span>
          <DonemSegmentedSwitch mode={donemMode} busy={donemBusy} onChange={onDonemChange} />
        </div>
        <button type="button" className="pm-quick-action" onClick={onLicenseCheck} disabled={licenseBusy}>
          <span className="pm-quick-action-icon" aria-hidden>◆</span>
          {licenseBusy ? "Kontrol ediliyor…" : "Lisansı kontrol et"}
        </button>
      </div>
    </section>
  );
}
