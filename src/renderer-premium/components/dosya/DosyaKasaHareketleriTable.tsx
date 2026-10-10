import { useMemo } from "react";
import type { KasaHareket } from "@shared/types/kasa";
import type { useDosyaKasa } from "../../hooks/useDosyaKasa";
import { useFinancePeriodFilter } from "../../hooks/useFinancePeriodFilter";
import { FinancePeriodSelector } from "../mali/FinancePeriodSelector";
import { formatTry } from "../../lib/format";
import {
  hareketAciklamaMasraf,
  formatBalanceImpact,
  formatDateTr,
  hareketGirisCikis,
  hareketKategori,
  hareketSatirSinifi,
  kasaDuzeltmeImpactSinifi,
  onayBadgeMetni,
  onayBadgeTone,
  tipEtiket,
} from "../../lib/kasa";
import { canShowDosyaKasaGuvenliSil } from "@shared/lib/guvenliSil";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";

type KasaApi = ReturnType<typeof useDosyaKasa>;

type Props = {
  kasa: KasaApi;
};

function RowActions({ h, kasa }: { h: KasaHareket; kasa: KasaApi }) {
  if (h.onayDurumu === "ONAYSIZ") {
    return (
      <div className="pm-kasa-actions">
        {h.islemTipi === "MASRAF" ? (
          <button type="button" className="pm-kasa-action" title="Düzenle" onClick={() => kasa.openMasrafDuzenle(h)}>
            ✎
          </button>
        ) : null}
        <button type="button" className="pm-kasa-action pm-kasa-action--primary" title="Onayla" onClick={() => kasa.onaylaHareket(h.id)}>
          ✓
        </button>
        <button type="button" className="pm-kasa-action" title="Reddet" onClick={() => kasa.reddetHareket(h.id)}>
          ✕
        </button>
        <button type="button" className="pm-kasa-action pm-kasa-action--danger" title="Sil" onClick={() => kasa.silHareket(h.id)}>
          🗑
        </button>
      </div>
    );
  }
  if (h.onayDurumu === "ONAYLI" && h.islemTipi !== "DUZELTME") {
    const guvenliMode = canShowDosyaKasaGuvenliSil(h);
    return (
      <div className="pm-kasa-actions">
        {kasa.makbuzGosterilebilir(h) ? (
          <button type="button" className="pm-kasa-action" title="Makbuz" onClick={() => void kasa.makbuzAc(h.id)}>
            🧾
          </button>
        ) : null}
        <button type="button" className="pm-kasa-action" title="Düzeltme ekle" onClick={() => kasa.setDuzeltmeHedef(h)}>
          ±
        </button>
        {guvenliMode ? (
          <button
            type="button"
            className="pm-kasa-action pm-kasa-action--danger"
            title="Güvenli sil"
            onClick={() => kasa.acGuvenliSil(h, guvenliMode)}
          >
            🗑
          </button>
        ) : null}
      </div>
    );
  }
  if (h.onayDurumu === "ONAYLI" && h.islemTipi === "DUZELTME" && kasa.makbuzGosterilebilir(h)) {
    return (
      <button type="button" className="pm-kasa-action" title="Makbuz" onClick={() => void kasa.makbuzAc(h.id)}>
        🧾
      </button>
    );
  }
  if (h.onayDurumu === "REDDEDILDI") {
    return (
      <button type="button" className="pm-kasa-action pm-kasa-action--danger" title="Sil" onClick={() => kasa.silHareket(h.id)}>
        🗑
      </button>
    );
  }
  return <span className="pm-muted">—</span>;
}

function TipCell({ h }: { h: KasaHareket }) {
  const ana = h.islemTipi === "DUZELTME" ? "Düzeltme" : tipEtiket(h.islemTipi);
  return (
    <div className="pm-kasa-tip">
      <span>{ana}</span>
      {!h.duzeltmeMi && (h.hasCorrection || h.duzeltildi) ? (
        <span className="pm-kasa-badge-duzeltildi" title="Bu işlem için düzeltme kaydı var">
          Düzeltildi
        </span>
      ) : null}
    </div>
  );
}

export function DosyaKasaHareketleriTable({ kasa }: Props) {
  const { financePeriod, setFinancePeriod, filterByPeriod, rangeKey } = useFinancePeriodFilter();

  const filtered = useMemo(
    () => filterByPeriod(kasa.hareketler),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kasa.hareketler, rangeKey],
  );

  const loading = kasa.listeLoading;
  const kayitSayisi = filtered.length;

  if (kasa.listeError && !kasa.hareketler.length) {
    return (
      <section className="pm-dosya-section pm-dosya-section--table">
        <div className="pm-section-head">
          <h2 className="pm-section-title">Dosya kasası hareketleri</h2>
        </div>
        <EmptyState title="Hareketler yüklenemedi" description={kasa.listeError} />
        <div className="pm-retry-wrap">
          <button type="button" className="pm-btn pm-btn--ghost" onClick={() => void kasa.yukleListe()}>
            Yeniden dene
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="pm-dosya-section pm-dosya-section--table">
      <div className="pm-section-head">
        <h2 className="pm-section-title">Dosya kasası hareketleri</h2>
        <div className="pm-section-head-right">
          <FinancePeriodSelector value={financePeriod} onChange={setFinancePeriod} disabled={loading} />
          <span className="pm-section-meta">{kayitSayisi === 1 ? "1 kayıt" : `${kayitSayisi} kayıt`}</span>
        </div>
      </div>

      <div className={`pm-kasa-table-wrap${loading ? " pm-kasa-table-wrap--loading" : ""}`}>
        {loading ? (
          <div className="pm-kasa-skeleton" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="pm-kasa-skeleton-row" />
            ))}
          </div>
        ) : kayitSayisi === 0 ? (
          <EmptyState title="Henüz kasa hareketi yok" description="İşlem ekle ile avans veya masraf kaydı oluşturabilirsiniz." />
        ) : (
          <table className="pm-kasa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tarih</th>
                <th>Tür</th>
                <th>Kategori</th>
                <th>Açıklama</th>
                <th className="pm-num">Giriş</th>
                <th className="pm-num">Çıkış</th>
                <th>Onay</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const { giris, cikis } = hareketGirisCikis(h);
                const highlighted = kasa.highlightId === h.id;
                return (
                  <tr
                    key={h.id}
                    className={`${hareketSatirSinifi(h)}${highlighted ? " pm-kasa-row--highlight" : ""}`}
                  >
                    <td className="pm-kasa-id">{h.id}</td>
                    <td>
                      {h.islemTipi === "DUZELTME" ? (
                        <div className="pm-kasa-tarih-duzeltme">
                          <span>{formatDateTr(h.economicTarih ?? h.tarih)}</span>
                          <span className="pm-kasa-duzeltme-tarih-alt">Düzeltme: {formatDateTr(h.tarih)}</span>
                        </div>
                      ) : (
                        formatDateTr(h.tarih)
                      )}
                    </td>
                    <td>
                      <TipCell h={h} />
                    </td>
                    <td>{hareketKategori(h)}</td>
                    <td className={h.duzeltmeMi ? "pm-kasa-aciklama-correction" : undefined}>
                      {h.islemTipi === "DUZELTME" ? (
                        <div className="pm-kasa-duzeltme-aciklama">
                          <strong>Düzeltme</strong>
                          {h.duzeltenUserAd ? <p>Düzelten: {h.duzeltenUserAd}</p> : null}
                          {(h.aciklama ?? "").trim() ? <p>Neden: {h.aciklama}</p> : null}
                          {h.bagliIslemUyari ? <p className="pm-kasa-orphan">{h.bagliIslemUyari}</p> : null}
                        </div>
                      ) : (
                        hareketAciklamaMasraf(h)
                      )}
                    </td>
                    <td className={`pm-num pm-kasa-giris${h.islemTipi === "DUZELTME" && giris != null ? ` ${kasaDuzeltmeImpactSinifi(h)}` : ""}`}>
                      {h.islemTipi === "DUZELTME" && giris != null
                        ? formatBalanceImpact(giris, "TRY")
                        : giris != null
                          ? formatTry(giris)
                          : "—"}
                    </td>
                    <td className={`pm-num pm-kasa-cikis${h.islemTipi === "DUZELTME" && cikis != null ? ` ${kasaDuzeltmeImpactSinifi(h)}` : ""}`}>
                      {h.islemTipi === "DUZELTME" && cikis != null
                        ? formatBalanceImpact(-Math.abs(cikis), "TRY")
                        : cikis != null
                          ? formatTry(cikis)
                          : "—"}
                    </td>
                    <td>
                      <StatusBadge tone={onayBadgeTone(h)}>{onayBadgeMetni(h)}</StatusBadge>
                    </td>
                    <td>
                      <RowActions h={h} kasa={kasa} />
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
