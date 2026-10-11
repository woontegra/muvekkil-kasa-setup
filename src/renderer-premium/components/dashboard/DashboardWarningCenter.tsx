import { Link } from "react-router-dom";
import type { VekaletTaksitUyariSatir } from "@shared/types/vekalet";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";
import { formatDateTr, formatTry } from "../../lib/format";
import { taksitDurumEtiket, taksitDurumTone } from "../../lib/vekalet";

type Props = {
  vadesiGecmisListe: VekaletTaksitUyariSatir[];
  loading?: boolean;
};

export function DashboardWarningCenter({ vadesiGecmisListe, loading }: Props) {
  return (
    <section className="pm-overview-panel pm-alerts-panel pm-dash-side-card" aria-label="Vadesi geçmiş taksitler">
      <div className="pm-alerts-head">
        <h2 className="pm-overview-panel-title">Uyarı merkezi</h2>
        <h3 className="pm-alerts-subtitle">Vadesi geçmiş taksitler</h3>
      </div>
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
