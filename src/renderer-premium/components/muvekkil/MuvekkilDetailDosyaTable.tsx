import { Link, useNavigate } from "react-router-dom";
import type { Dosya } from "@shared/types/dosya";
import { PremiumButton } from "../PremiumButton";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";
import { dosyaDurumEtiket, dosyaDurumTone } from "../../lib/dosya";
import { formatDateTr } from "../../lib/format";

type Props = {
  muvekkilId: number;
  dosyalar: Dosya[];
  onNewDosya: () => void;
  onEditDosya: (d: Dosya) => void;
};

export function MuvekkilDetailDosyaTable({ muvekkilId, dosyalar, onNewDosya, onEditDosya }: Props) {
  const navigate = useNavigate();

  return (
    <section className="pm-mvk-detail-main" aria-label="Dosyalar">
      <div className="pm-mvk-data-shell pm-mvk-detail-dosya-shell">
        <div className="pm-mvk-detail-dosya-head">
          <div>
            <h3 className="pm-mvk-detail-panel-title">Dosyalar</h3>
            <p className="pm-mvk-detail-dosya-meta">
              {dosyalar.length === 0
                ? "Henüz kayıtlı dosya yok"
                : dosyalar.length === 1
                  ? "1 kayıtlı dosya"
                  : `${dosyalar.length} kayıtlı dosya`}
            </p>
          </div>
          <PremiumButton type="button" onClick={onNewDosya}>
            + Yeni dosya
          </PremiumButton>
        </div>

        {dosyalar.length === 0 ? (
          <div className="pm-mvk-empty pm-mvk-empty--enter">
            <EmptyState
              title="Henüz dosya yok"
              description="Yeni dosya ekleyerek bu müvekkile ait dava ve icra kayıtlarını takip edebilirsiniz."
            />
            <PremiumButton type="button" className="pm-mvk-empty-cta" onClick={onNewDosya}>
              + İlk dosyayı ekle
            </PremiumButton>
          </div>
        ) : (
          <div className="pm-mvk-table-scroll pm-mvk-detail-table-scroll">
            <table className="pm-mvk-data-table">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Dosya konusu</th>
                  <th>Mahkeme / icra</th>
                  <th>Dosya no</th>
                  <th>Durum</th>
                  <th>Kayıt</th>
                  <th className="pm-mvk-col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {dosyalar.map((d) => (
                  <tr
                    key={d.id}
                    className="pm-mvk-data-row"
                    tabIndex={0}
                    onClick={() => navigate(`/muvekkil/${muvekkilId}/dosya/${d.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/muvekkil/${muvekkilId}/dosya/${d.id}`);
                      }
                    }}
                  >
                    <td className="num">
                      <span className="pm-mvk-file-count">{d.id}</span>
                    </td>
                    <td className="pm-mvk-col-name">
                      <span className="pm-mvk-data-name">{(d.konuBasligi ?? "").trim() || "—"}</span>
                      {(d.aciklama ?? "").trim() ? (
                        <span className="pm-mvk-data-id pm-mvk-cell-ellipsis" title={(d.aciklama ?? "").trim()}>
                          {(d.aciklama ?? "").trim()}
                        </span>
                      ) : null}
                    </td>
                    <td className="pm-mvk-cell-ellipsis" title={(d.mahkemeAdi ?? "").trim() || undefined}>
                      {(d.mahkemeAdi ?? "").trim() || "—"}
                    </td>
                    <td>{(d.dosyaNumarasi ?? "").trim() || "—"}</td>
                    <td>
                      <StatusBadge tone={dosyaDurumTone(d.durum)}>{dosyaDurumEtiket(d.durum)}</StatusBadge>
                    </td>
                    <td className="pm-mvk-col-phone">{d.kayitTarihi ? formatDateTr(d.kayitTarihi) : "—"}</td>
                    <td className="pm-mvk-col-actions">
                      <div className="pm-mvk-row-actions" onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={`/muvekkil/${muvekkilId}/dosya/${d.id}`}
                          className="pm-mvk-icon-btn"
                          title="Detayı aç"
                          aria-label="Detayı aç"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          className="pm-mvk-icon-btn"
                          title="Düzenle"
                          aria-label="Düzenle"
                          onClick={() => onEditDosya(d)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
