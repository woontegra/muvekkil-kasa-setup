import { useCallback, useEffect, useState } from "react";
import type { MuvekkilKarlilikPayload, MuvekkilKarlilikResponse } from "@shared/types/muvekkilKarlilik";
import type { MuvekkilOfisGelirSatir } from "@shared/types/muvekkilOfisGelir";
import { KARLILIK_CURRENCIES, moneyStringNonZero } from "@shared/lib/karlilikParaBirimi";
import { formatMoney } from "@shared/lib/paraBirimi";
import { formatDateTr } from "../lib/format";

type Props = { muvekkilId: number };

export function LegacyMuvekkilKarlilikSection({ muvekkilId }: Props) {
  const [data, setData] = useState<MuvekkilKarlilikResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ofisRows, setOfisRows] = useState<MuvekkilOfisGelirSatir[]>([]);

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
      const r = await window.api.muvekkilOfisGelirleri(muvekkilId, { page: 1, limit: 20 });
      setOfisRows(r.items);
    } catch {
      setOfisRows([]);
    }
  }, [muvekkilId]);

  useEffect(() => {
    void yukle();
    void yukleOfis();
  }, [yukle, yukleOfis]);

  const payload: MuvekkilKarlilikPayload | null = data?.tumZamanlar ?? null;

  return (
    <section className="section-card desk-panel" aria-label="Müvekkil kârlılık">
      <div className="desk-panel-head">
        <span>Kârlılık özeti</span>
      </div>
      <div className="desk-panel-body desk-panel-body--pad-sm">
        {err ? <p className="desk-muted-compact">{err}</p> : null}
        {payload ? (
          <ul className="desk-list-compact">
            {KARLILIK_CURRENCIES.filter(
              (pb) =>
                moneyStringNonZero(payload.netKazanc[pb]) ||
                moneyStringNonZero(payload.tahsilEdilenVekalet[pb]) ||
                moneyStringNonZero(payload.ofisGeliri[pb]) ||
                pb === "TRY",
            ).map((pb) => (
              <li key={pb}>
                Net ({pb}): <strong>{formatMoney(Number(payload.netKazanc[pb]), pb)}</strong> — Tahsil{" "}
                {formatMoney(Number(payload.tahsilEdilenVekalet[pb]), pb)} · Ofis{" "}
                {formatMoney(Number(payload.ofisGeliri[pb]), pb)} · Gider{" "}
                {formatMoney(Number(payload.gider[pb]), pb)}
              </li>
            ))}
            <li>Dosya sayısı: {payload.toplamDosya}</li>
          </ul>
        ) : null}
        <h3 className="desk-panel-subhead">Ofis gelirleri</h3>
        {ofisRows.length === 0 ? (
          <p className="desk-muted-compact">Bağlı ofis geliri yok.</p>
        ) : (
          <table className="desk-table desk-table--striped desk-table--compact">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Açıklama</th>
                <th className="desk-num">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {ofisRows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTr(r.tarih)}</td>
                  <td>{r.aciklama ?? r.kategori}</td>
                  <td className="desk-num">{formatMoney(r.tutar, r.paraBirimi as "TRY" | "USD" | "EUR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
