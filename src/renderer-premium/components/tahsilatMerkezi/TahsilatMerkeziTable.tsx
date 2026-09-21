import { formatMoney } from "@shared/lib/paraBirimi";
import type { TahsilatMerkeziSatir } from "@shared/types/tahsilatMerkezi";
import type { UseTahsilatMerkeziReturn } from "../../hooks/useTahsilatMerkezi";
import { PremiumButton } from "../PremiumButton";

type Props = {
  tm: UseTahsilatMerkeziReturn;
};

function durumLabel(d: TahsilatMerkeziSatir["durum"]): string {
  switch (d) {
    case "GECIKTI":
      return "Gecikti";
    case "KISMI_ODENDI":
      return "Kısmi ödendi";
    case "ODENMEDI":
      return "Ödenmedi";
    case "ODENDI":
      return "Ödendi";
    default:
      return d;
  }
}

function gunFarkiLabel(gun: number): string {
  if (gun < 0) return `${Math.abs(gun)} gün gecikti`;
  if (gun === 0) return "Bugün";
  return `${gun} gün kaldı`;
}

export function TahsilatMerkeziTable({ tm }: Props) {
  const { items, listeLoading, listeError, total, page, totalPages, smmSavingId } = tm;

  return (
    <section className="pm-tahsilat-table-wrap pm-stagger-item" aria-label="Tahsilat listesi">
      {listeError ? (
        <div className="pm-tahsilat-table-error">
          <span>{listeError}</span>
          <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={() => void tm.yukleListe()}>
            Yeniden dene
          </button>
        </div>
      ) : null}

      <div className="pm-tahsilat-table-meta">
        <span>{listeLoading ? "Yükleniyor…" : `${total} kayıt`}</span>
        {totalPages > 1 ? (
          <div className="pm-tahsilat-pagination">
            <PremiumButton
              type="button"
              variant="ghost"
              className="pm-btn--sm"
              disabled={page <= 1 || listeLoading}
              onClick={() => tm.setPage((p) => Math.max(1, p - 1))}
            >
              Önceki
            </PremiumButton>
            <span>
              {page} / {totalPages}
            </span>
            <PremiumButton
              type="button"
              variant="ghost"
              className="pm-btn--sm"
              disabled={page >= totalPages || listeLoading}
              onClick={() => tm.setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sonraki
            </PremiumButton>
          </div>
        ) : null}
      </div>

      <div className="pm-tahsilat-table-scroll">
        <table className="pm-tahsilat-table">
          <thead>
            <tr>
              <th>Müvekkil</th>
              <th>Dosya</th>
              <th>Taksit</th>
              <th>Vade</th>
              <th>Kalan</th>
              <th>Durum</th>
              <th aria-label="İşlemler" />
            </tr>
          </thead>
          <tbody>
            {listeLoading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="pm-tahsilat-empty">
                  Yükleniyor…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="pm-tahsilat-empty">
                  Bu filtrede açık taksit bulunamadı.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const smmId = row.taksit.smmBekleyenOdemeId;
                const smmBusy = smmId != null && smmSavingId === smmId;
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="pm-tahsilat-cell-main">{row.muvekkilAd}</span>
                    </td>
                    <td>
                      <span className="pm-tahsilat-cell-main">{row.dosyaBaslik}</span>
                      {row.dosyaNo ? <span className="pm-tahsilat-cell-sub">{row.dosyaNo}</span> : null}
                    </td>
                    <td>
                      <span className="pm-tahsilat-cell-main">#{row.taksitNo}</span>
                      {row.taksitAciklama ? <span className="pm-tahsilat-cell-sub">{row.taksitAciklama}</span> : null}
                    </td>
                    <td>
                      <span className="pm-tahsilat-cell-main">{row.vadeTarihi}</span>
                      <span
                        className={`pm-tahsilat-cell-sub${row.gunFarki < 0 ? " pm-tahsilat-cell-sub--danger" : ""}`}
                      >
                        {gunFarkiLabel(row.gunFarki)}
                      </span>
                    </td>
                    <td>
                      <span className="pm-tahsilat-cell-main">{formatMoney(row.kalanTutar, row.taksit.paraBirimi)}</span>
                      <span className="pm-tahsilat-cell-sub">
                        / {formatMoney(row.taksitTutari, row.taksit.paraBirimi)}
                      </span>
                    </td>
                    <td>
                      <span className={`pm-tahsilat-badge pm-tahsilat-badge--${row.durum.toLowerCase()}`}>
                        {durumLabel(row.durum)}
                      </span>
                    </td>
                    <td>
                      <div className="pm-tahsilat-row-actions">
                        {row.durum !== "ODENDI" ? (
                          <PremiumButton type="button" className="pm-btn--sm" onClick={() => tm.odemeAc(row)}>
                            Ödeme al
                          </PremiumButton>
                        ) : null}
                        {smmId != null ? (
                          <PremiumButton
                            type="button"
                            variant="ghost"
                            className="pm-btn--sm"
                            disabled={smmBusy}
                            onClick={() => void tm.smmKes(smmId)}
                          >
                            {smmBusy ? "…" : "SMM kesildi"}
                          </PremiumButton>
                        ) : null}
                        <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={() => tm.dosyayaGit(row)}>
                          Dosyaya git
                        </PremiumButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
