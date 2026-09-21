import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MuvekkilKarlilikPayload, MuvekkilKarlilikResponse } from "@shared/types/muvekkilKarlilik";
import type { MuvekkilOfisGelirSatir } from "@shared/types/muvekkilOfisGelir";
import { moneyStringNonZero, KARLILIK_CURRENCIES } from "@shared/lib/karlilikParaBirimi";
import { formatMoney } from "@shared/lib/paraBirimi";
import { formatDateTr } from "../../lib/format";
import { ofisKasaKategoriListeEtiketi } from "../../lib/ofisKasa";

type Props = { muvekkilId: number };
type StatTone = "neutral" | "info" | "gelir" | "gider" | "net-pos" | "net-neg" | "net-zero";

function netTone(n: number): StatTone {
  if (n > 0) return "net-pos";
  if (n < 0) return "net-neg";
  return "net-zero";
}

function StatMini({ label, value, tone = "neutral", hint }: { label: string; value: string; tone?: StatTone; hint?: string }) {
  return (
    <article className={`pm-karlilik-stat pm-karlilik-stat--${tone}`}>
      <span className="pm-karlilik-stat-label">{label}</span>
      <strong className="pm-karlilik-stat-value">{value}</strong>
      {hint ? <span className="pm-karlilik-stat-hint">{hint}</span> : null}
    </article>
  );
}

export function MuvekkilKarlilikSection({ muvekkilId }: Props) {
  const [data, setData] = useState<MuvekkilKarlilikResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scope, setScope] = useState<"tum" | "donem">("tum");
  const [ofisRows, setOfisRows] = useState<MuvekkilOfisGelirSatir[]>([]);
  const [ofisTotal, setOfisTotal] = useState(0);
  const [ofisPage, setOfisPage] = useState(1);

  const yukle = useCallback(async () => {
    try {
      const r = await window.api.muvekkilKarlilik(muvekkilId);
      if (!r.ok) {
        setErr(r.error);
        setData(null);
        return;
      }
      setErr(null);
      setData(r.data);
    } catch {
      setErr("Kârlılık yüklenemedi.");
    }
  }, [muvekkilId]);

  const yukleOfis = useCallback(async () => {
    try {
      const r = await window.api.muvekkilOfisGelirleri(muvekkilId, { page: ofisPage, limit: 20 });
      setOfisRows(r.items);
      setOfisTotal(r.total);
    } catch {
      setOfisRows([]);
      setOfisTotal(0);
    }
  }, [muvekkilId, ofisPage]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    void yukleOfis();
  }, [yukleOfis]);

  const payload: MuvekkilKarlilikPayload | null =
    data == null ? null : scope === "donem" && data.buDonem ? data.buDonem : data.tumZamanlar;

  return (
    <section className="pm-dosya-section pm-karlilik-section" aria-label="Müvekkil kârlılık">
      <div className="pm-section-head">
        <h2 className="pm-section-title">Kârlılık Analizi</h2>
        <div className="pm-kalem-tabs" role="tablist" aria-label="Dönem">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "tum"}
            className={`pm-kalem-tab${scope === "tum" ? " pm-kalem-tab--active" : ""}`}
            onClick={() => setScope("tum")}
          >
            Tüm zamanlar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "donem"}
            className={`pm-kalem-tab${scope === "donem" ? " pm-kalem-tab--active" : ""}`}
            onClick={() => setScope("donem")}
            disabled={!data?.buDonem}
          >
            {data?.donemEtiketi ?? "Bu dönem"}
          </button>
        </div>
      </div>
      {err ? <p className="pm-form-error">{err}</p> : null}
      {payload ? (
        <>
          <div className="pm-karlilik-grid">
            <StatMini label="Dosya sayısı" value={String(payload.toplamDosya)} tone="info" />
            {KARLILIK_CURRENCIES.flatMap((pb) => {
              const cards = [];
              if (moneyStringNonZero(payload.tahsilEdilenVekalet[pb]) || moneyStringNonZero(payload.ofisGeliri[pb])) {
                cards.push(
                  <StatMini
                    key={`gelir-${pb}`}
                    label={`Gelir (${pb})`}
                    value={formatMoney(
                      Number(payload.tahsilEdilenVekalet[pb]) + Number(payload.ofisGeliri[pb]),
                      pb,
                    )}
                    tone="gelir"
                    hint={`Tahsil ${formatMoney(Number(payload.tahsilEdilenVekalet[pb]), pb)} · Ofis ${formatMoney(Number(payload.ofisGeliri[pb]), pb)}`}
                  />,
                );
              }
              if (moneyStringNonZero(payload.gider[pb])) {
                cards.push(
                  <StatMini
                    key={`gider-${pb}`}
                    label={`Gider (${pb})`}
                    value={formatMoney(Number(payload.gider[pb]), pb)}
                    tone="gider"
                  />,
                );
              }
              if (
                moneyStringNonZero(payload.netKazanc[pb]) ||
                moneyStringNonZero(payload.tahsilEdilenVekalet[pb]) ||
                moneyStringNonZero(payload.ofisGeliri[pb]) ||
                moneyStringNonZero(payload.gider[pb]) ||
                pb === "TRY"
              ) {
                const n = Number(payload.netKazanc[pb]);
                cards.push(
                  <StatMini
                    key={`net-${pb}`}
                    label={`Net kazanç (${pb})`}
                    value={formatMoney(n, pb)}
                    tone={netTone(n)}
                  />,
                );
              }
              return cards;
            })}
            <StatMini
              label="Avans bakiyesi (TRY)"
              value={formatMoney(Number(payload.toplamAvansBakiye), "TRY")}
              tone="info"
            />
            <StatMini
              label="Toplam masraf (TRY)"
              value={formatMoney(Number(payload.toplamDosyaMasrafi), "TRY")}
              tone="gider"
            />
          </div>
          <p className="pm-karlilik-footnote">
            Tutarlar para birimine göre ayrıdır; TRY, USD ve EUR birleştirilmez. Net = ilgili PB geliri − aynı PB gideri.
          </p>
          {KARLILIK_CURRENCIES.some((pb) => payload.kazancDagilimi[pb]) ? (
            <div className="pm-karlilik-dagilim">
              <h3 className="pm-section-title">Kazanç dağılımı</h3>
              {KARLILIK_CURRENCIES.map((pb) => {
                const d = payload.kazancDagilimi[pb];
                if (!d) return null;
                return (
                  <div key={pb} className="pm-karlilik-dagilim-block">
                    <h4 className="pm-karlilik-dagilim-pb">{pb}</h4>
                    {d.enYuksekKazanc ? (
                      <div className="pm-karlilik-dagilim-row">
                        <span className="pm-muted">En yüksek:</span>
                        <Link to={`/muvekkil/${muvekkilId}/dosya/${d.enYuksekKazanc.dosyaId}`}>
                          {d.enYuksekKazanc.konuBasligi}
                        </Link>
                        <strong className={`pm-karlilik-stat-value--${netTone(Number(d.enYuksekKazanc.netKazanc))}`}>
                          {formatMoney(Number(d.enYuksekKazanc.netKazanc), pb)}
                        </strong>
                      </div>
                    ) : null}
                    {d.enDusukKazanc && d.enDusukKazanc.dosyaId !== d.enYuksekKazanc?.dosyaId ? (
                      <div className="pm-karlilik-dagilim-row">
                        <span className="pm-muted">En düşük:</span>
                        <Link to={`/muvekkil/${muvekkilId}/dosya/${d.enDusukKazanc.dosyaId}`}>
                          {d.enDusukKazanc.konuBasligi}
                        </Link>
                        <strong className={`pm-karlilik-stat-value--${netTone(Number(d.enDusukKazanc.netKazanc))}`}>
                          {formatMoney(Number(d.enDusukKazanc.netKazanc), pb)}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="pm-section-head">
        <h3 className="pm-section-title">Ofis gelirleri</h3>
        <span className="pm-section-meta">{ofisTotal} kayıt</span>
      </div>
      {ofisRows.length === 0 ? (
        <p className="pm-muted">Bu müvekkile bağlı ofis geliri yok.</p>
      ) : (
        <div className="pm-ofis-table-wrap">
          <table className="pm-ofis-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kalem</th>
                <th>Açıklama</th>
                <th>Personel</th>
                <th className="num">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {ofisRows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTr(r.tarih)}</td>
                  <td>{ofisKasaKategoriListeEtiketi(r.kategori, r.ozelKategoriAdi)}</td>
                  <td>{r.aciklama ?? "—"}</td>
                  <td>{r.tahsilatiYapanKullaniciAdi ?? "—"}</td>
                  <td className="num">{formatMoney(r.tutar, r.paraBirimi as "TRY" | "USD" | "EUR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ofisTotal > 20 ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="pm-btn pm-btn--sm" disabled={ofisPage <= 1} onClick={() => setOfisPage((p) => p - 1)}>
            Önceki
          </button>
          <button
            type="button"
            className="pm-btn pm-btn--sm"
            disabled={ofisPage * 20 >= ofisTotal}
            onClick={() => setOfisPage((p) => p + 1)}
          >
            Sonraki
          </button>
        </div>
      ) : null}
    </section>
  );
}
