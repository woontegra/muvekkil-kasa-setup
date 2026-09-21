import type { OfisKasaHareketListeSatir } from "@shared/types/ofisKasa";
import type { useOfisKasa } from "../../hooks/useOfisKasa";
import { formatDateTr } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import {
  duzeltmeAltSatir,
  hareketGelirGiderHucre,
  islemTipiEtiket,
  ofisKasaAciklamaMetni,
  ofisKasaKategoriListeEtiketi,
  ofisKasaSatirSinifi,
  ofisKasaTurEkMetni,
  odemeEtiket,
  onayBadgeMetni,
  onayBadgeTone,
  satirAuditTitle,
} from "../../lib/ofisKasa";
import { canShowOfisGuvenliSil } from "@shared/lib/guvenliSil";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";

type OfisApi = ReturnType<typeof useOfisKasa>;

type Props = {
  ofis: OfisApi;
};

function RowActions({ h, ofis }: { h: OfisKasaHareketListeSatir; ofis: OfisApi }) {
  if (h.onayDurumu === "ONAYSIZ") {
    return (
      <div className="pm-ofis-actions">
        {h.islemTipi !== "DUZELTME" ? (
          <button type="button" className="pm-ofis-action" title="Düzenle" onClick={() => ofis.modalAcDuzenle(h)}>
            ✎
          </button>
        ) : null}
        <button type="button" className="pm-ofis-action pm-ofis-action--primary" title="Onayla" onClick={() => ofis.onaylaHareket(h.id)}>
          ✓
        </button>
        <button type="button" className="pm-ofis-action pm-ofis-action--danger" title="Sil" onClick={() => ofis.silHareket(h.id)}>
          🗑
        </button>
      </div>
    );
  }
  if (h.onayDurumu === "ONAYLI") {
    if (h.islemTipi === "DUZELTME") {
      return <span className="pm-muted">—</span>;
    }
    if (h.hasCorrection) {
      return (
        <span className="pm-muted" title="Bu kayıt için zaten düzeltme yapılmış">
          Düzeltildi
        </span>
      );
    }
    const guvenliMode = canShowOfisGuvenliSil(h);
    return (
      <div className="pm-ofis-actions">
        <button type="button" className="pm-ofis-action" title="Düzeltme ekle" onClick={() => ofis.acDuzeltme(h)}>
          ±
        </button>
        {guvenliMode ? (
          <button
            type="button"
            className="pm-ofis-action pm-ofis-action--danger"
            title="Güvenli sil"
            onClick={() => ofis.acGuvenliSil(h, guvenliMode)}
          >
            🗑
          </button>
        ) : null}
      </div>
    );
  }
  return null;
}

function TipCell({ h }: { h: OfisKasaHareketListeSatir }) {
  const ana = h.islemTipi === "DUZELTME" ? "Düzeltme" : islemTipiEtiket(h.islemTipi);
  return (
    <div className="pm-ofis-tip">
      <span>{ana}</span>
      {h.islemTipi !== "DUZELTME" && h.hasCorrection ? (
        <span className="pm-ofis-badge-duzeltildi" title="Bu işlem için düzeltme kaydı var">
          Düzeltildi
        </span>
      ) : null}
    </div>
  );
}

export function OfisKasaTable({ ofis }: Props) {
  const { hareketler, listeLoading, listeError, highlightId, yukleListe } = ofis;

  return (
    <section className="pm-dosya-section pm-dosya-section--table pm-ofis-table-section pm-stagger-item" aria-label="İşlem listesi">
      <div className="pm-section-head">
        <h2 className="pm-section-title">İşlem listesi</h2>
        <div className="pm-section-head-right">
          <span className="pm-section-meta">
            {listeLoading
              ? "Yükleniyor…"
              : hareketler.length === 1
                ? "1 kayıt"
                : `${hareketler.length} kayıt`}
          </span>
        </div>
      </div>

      {listeError ? (
        <div className="pm-ofis-table-error">
          <span>{listeError}</span>
          <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={() => void yukleListe()}>
            Yeniden dene
          </button>
        </div>
      ) : null}

      <div className="pm-ofis-table-wrap">
        {listeLoading && hareketler.length === 0 ? (
          <div className="pm-ofis-table-skeleton" aria-hidden />
        ) : hareketler.length === 0 ? (
          <EmptyState title="Kayıt bulunamadı" description="Bu filtrelere uygun kayıt yok." />
        ) : (
          <table className="pm-ofis-table">
            <thead>
              <tr>
                <th className="pm-col-id">#</th>
                <th>Tarih</th>
                <th>Tür</th>
                <th>Kategori</th>
                <th>Müvekkil</th>
                <th>Personel</th>
                <th>Açıklama</th>
                <th>Ödeme</th>
                <th className="num">Gelir</th>
                <th className="num">Gider</th>
                <th>Belge</th>
                <th>Durum</th>
                <th>Bağlı</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h) => {
                const { gelir, gider } = hareketGelirGiderHucre(h);
                const rowCls = [
                  ofisKasaSatirSinifi(h),
                  h.id === highlightId ? "pm-ofis-row--highlight" : "",
                  "pm-ofis-row-enter",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr key={h.id} className={rowCls} title={satirAuditTitle(h)}>
                    <td className="pm-col-id">{h.id}</td>
                    <td>{formatDateTr(h.tarih)}</td>
                    <td>
                      <TipCell h={h} />
                    </td>
                    <td>{ofisKasaKategoriListeEtiketi(h.kategori, h.ozelKategoriAdi)}</td>
                    <td>{h.muvekkilAdiSnapshot?.trim() || "—"}</td>
                    <td>{h.tahsilatiYapanKullaniciAdi?.trim() || "—"}</td>
                    <td className={h.islemTipi === "DUZELTME" ? "pm-ofis-aciklama--duzeltme" : undefined}>
                      {ofisKasaAciklamaMetni(h)}
                      {duzeltmeAltSatir(h) ? <div className="pm-ofis-duzeltme-alt">{duzeltmeAltSatir(h)}</div> : null}
                    </td>
                    <td>{odemeEtiket(h)}</td>
                    <td className="num pm-ofis-gelir">{gelir != null ? formatMoney(gelir, h.paraBirimi) : "—"}</td>
                    <td className="num pm-ofis-gider">{gider != null ? formatMoney(gider, h.paraBirimi) : "—"}</td>
                    <td>{h.belgeNo?.trim() ? h.belgeNo : "—"}</td>
                    <td>
                      <StatusBadge tone={onayBadgeTone(h)}>{onayBadgeMetni(h)}</StatusBadge>
                    </td>
                    <td className="pm-ofis-bagli">{ofisKasaTurEkMetni(h)}</td>
                    <td>
                      <RowActions h={h} ofis={ofis} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
