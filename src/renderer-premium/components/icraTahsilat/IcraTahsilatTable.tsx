import type { useIcraTahsilat } from "../../hooks/useIcraTahsilat";
import { formatMoney } from "@shared/lib/paraBirimi";
import {
  icraAlacakDurumEtiket,
  icraAlacakDurumTone,
  icraAlacakTuruEtiket,
  ilgiliMuvekkilDosyaMetni,
} from "../../lib/icraTahsilat";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";

type IcraApi = ReturnType<typeof useIcraTahsilat>;

type Props = {
  icra: IcraApi;
};

export function IcraTahsilatTable({ icra }: Props) {
  const { liste, listeLoading, listeError, highlightId, yukleListe, setDetay } = icra;

  return (
    <section className="pm-dosya-section pm-dosya-section--table pm-icra-table-section pm-stagger-item" aria-label="Alacak listesi">
      <div className="pm-section-head">
        <h2 className="pm-section-title">İcra tahsilat alacakları</h2>
        <span className="pm-section-meta">{liste.length} kayıt</span>
      </div>

      {listeError ? (
        <div className="pm-icra-table-error">
          <span>{listeError}</span>
          <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={() => void yukleListe()}>
            Yeniden dene
          </button>
        </div>
      ) : null}

      <div className="pm-icra-table-wrap">
        {listeLoading && liste.length === 0 ? (
          <div className="pm-icra-table-skeleton" aria-hidden />
        ) : liste.length === 0 ? (
          <EmptyState title="Kayıt bulunamadı" description="Bu filtrelere uygun alacak kaydı yok." />
        ) : (
          <table className="pm-icra-table">
            <thead>
              <tr>
                <th className="pm-col-id">#</th>
                <th>Borçlu / karşı taraf</th>
                <th>İlgili müvekkil / dosya</th>
                <th>Alacak türü</th>
                <th className="num">Toplam</th>
                <th className="num">Ödenen</th>
                <th className="num">Kalan</th>
                <th>Taksit</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((a) => (
                <tr
                  key={a.id}
                  className={[
                    a.id === highlightId ? "pm-icra-row--highlight" : "",
                    "pm-icra-row-enter",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td className="pm-col-id">{a.id}</td>
                  <td className="pm-icra-borclu">{a.borcluAdi}</td>
                  <td className="pm-icra-muvekkil" title={ilgiliMuvekkilDosyaMetni(a.muvekkilAdi, a.dosyaKonu)}>
                    {ilgiliMuvekkilDosyaMetni(a.muvekkilAdi, a.dosyaKonu)}
                  </td>
                  <td>{icraAlacakTuruEtiket(a.alacakTuru)}</td>
                  <td className="num">{formatMoney(a.toplamTutar, a.paraBirimi)}</td>
                  <td className="num pm-icra-tahsil">{formatMoney(a.odenenToplam, a.paraBirimi)}</td>
                  <td className="num">{formatMoney(a.kalanTutar, a.paraBirimi)}</td>
                  <td className="pm-icra-taksit-say">{a.taksitSayisi}</td>
                  <td>
                    <StatusBadge tone={icraAlacakDurumTone(a.durum)}>{icraAlacakDurumEtiket(a.durum)}</StatusBadge>
                  </td>
                  <td>
                    <button type="button" className="pm-icra-action pm-icra-action--primary" onClick={() => setDetay(a)}>
                      Detay
                    </button>
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
