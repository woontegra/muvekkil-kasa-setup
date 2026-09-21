import { useEffect, useRef, useState } from "react";
import {
  PARA_BIRIMLERI,
  PARA_BIRIMI_LABEL,
  formatMoney,
  type KurKaynagi,
  type ParaBirimi,
} from "@shared/lib/paraBirimi";
import { formatCurrencyInputTR, parsePosTutar } from "../../lib/format";
import { MoneyInput } from "../MoneyInput";

export type KurMeta = {
  kurKaynagi?: KurKaynagi;
  tcmbKurTarihi?: string | null;
  tcmbReferansKur?: number | null;
};

export type CrossCurrencyValue = KurMeta & {
  tutar: number | null;
  odemeParaBirimi: ParaBirimi;
  kasaTutari: number | null;
};

export function ParaBirimiSelect({
  id,
  value,
  onChange,
  disabled,
  className = "pm-input",
}: {
  id?: string;
  value: ParaBirimi;
  onChange: (value: ParaBirimi) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select id={id} className={className} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as ParaBirimi)}>
      {PARA_BIRIMLERI.map((pb) => <option key={pb} value={pb}>{pb} — {PARA_BIRIMI_LABEL[pb]}</option>)}
    </select>
  );
}

export function CurrencyBalanceCards({
  bakiyeler,
  loading,
  label = "Kasa bakiyesi",
}: {
  bakiyeler?: Partial<Record<ParaBirimi, number>> | null;
  loading?: boolean;
  label?: string;
}) {
  const toneByPb: Record<ParaBirimi, string> = {
    TRY: "pb-try",
    USD: "pb-usd",
    EUR: "pb-eur",
  };
  return (
    <>
      {PARA_BIRIMLERI.map((pb) => (
        <article
          key={pb}
          className={`pm-finance-kpi pm-finance-kpi--${toneByPb[pb]} pm-stagger-item`}
          data-kpi-tone={toneByPb[pb]}
          data-pb={pb}
        >
          <div className="pm-finance-kpi-body">
            <span className="pm-finance-kpi-label">
              {label} · {pb}
            </span>
            <span className="pm-finance-kpi-value">{loading ? "…" : formatMoney(bakiyeler?.[pb] ?? 0, pb)}</span>
          </div>
        </article>
      ))}
    </>
  );
}

export function CrossCurrencyPaymentFields({
  alacakParaBirimi,
  kalanBorc,
  disabled,
  initialTutar = "",
  onChange,
  idPrefix,
}: {
  alacakParaBirimi: ParaBirimi;
  kalanBorc: number;
  disabled?: boolean;
  initialTutar?: string;
  onChange: (value: CrossCurrencyValue) => void;
  idPrefix: string;
}) {
  const [tutar, setTutar] = useState(initialTutar);
  const [odemePb, setOdemePb] = useState<ParaBirimi>(alacakParaBirimi);
  const [kasaTutari, setKasaTutari] = useState(initialTutar);
  const [kurMeta, setKurMeta] = useState<KurMeta>({});
  const [kurMesaj, setKurMesaj] = useState("");
  const requestSeq = useRef(0);

  useEffect(() => {
    setTutar(initialTutar);
    setOdemePb(alacakParaBirimi);
    setKasaTutari(initialTutar);
    setKurMeta({});
    setKurMesaj("");
  }, [alacakParaBirimi, initialTutar]);

  useEffect(() => {
    onChange({
      tutar: parsePosTutar(tutar),
      odemeParaBirimi: odemePb,
      kasaTutari: parsePosTutar(kasaTutari),
      ...kurMeta,
    });
  }, [tutar, odemePb, kasaTutari, kurMeta, onChange]);

  async function tcmbOner() {
    const mahsup = parsePosTutar(tutar);
    if (!mahsup || odemePb === alacakParaBirimi) return;
    const seq = ++requestSeq.current;
    setKurMesaj("TCMB kuru alınıyor…");
    try {
      const r = await window.api.kurlarTcmbCapraz({ baz: alacakParaBirimi, karsi: odemePb });
      if (seq !== requestSeq.current) return;
      if (!r.ok || !r.available) {
        setKurMesaj(r.error ?? "TCMB kuru bulunamadı; tutarı elle girin.");
        return;
      }
      const kur = Number(r.dovizAlis);
      if (!Number.isFinite(kur) || kur <= 0) throw new Error();
      setKasaTutari(formatCurrencyInputTR(mahsup * kur));
      setKurMeta({ kurKaynagi: "TCMB", tcmbKurTarihi: r.bulunanTcmbKurTarihi, tcmbReferansKur: kur });
      setKurMesaj(`TCMB ${r.bulunanTcmbKurTarihi}: 1 ${alacakParaBirimi} = ${kur.toFixed(8)} ${odemePb}`);
    } catch {
      setKurMesaj("TCMB kuru alınamadı; tutarı elle girin.");
    }
  }

  const cross = odemePb !== alacakParaBirimi;
  return (
    <>
      <div className="pm-field">
        <label htmlFor={`${idPrefix}-mahsup`}>Borçtan düşülecek ({alacakParaBirimi}) *</label>
        <MoneyInput id={`${idPrefix}-mahsup`} value={tutar} onChange={(v) => {
          setTutar(v);
          if (!cross) setKasaTutari(v);
        }} maxValue={kalanBorc} disabled={disabled} />
      </div>
      <div className="pm-field">
        <label htmlFor={`${idPrefix}-pb`}>Ödeme para birimi</label>
        <ParaBirimiSelect id={`${idPrefix}-pb`} value={odemePb} disabled={disabled} onChange={(pb) => {
          setOdemePb(pb);
          setKurMeta({});
          setKurMesaj("");
          if (pb === alacakParaBirimi) setKasaTutari(tutar);
        }} />
      </div>
      {cross ? (
        <div className="pm-field pm-form-span2">
          <label htmlFor={`${idPrefix}-kasa`}>Kasaya giren ({odemePb}) *</label>
          <div className="pm-vekalet-odeme-tutar-row">
            <MoneyInput id={`${idPrefix}-kasa`} value={kasaTutari} disabled={disabled} onChange={(v) => {
              setKasaTutari(v);
              setKurMeta({ kurKaynagi: "MANUEL", tcmbKurTarihi: null, tcmbReferansKur: null });
            }} />
            <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" disabled={disabled || !parsePosTutar(tutar)} onClick={() => void tcmbOner()}>
              TCMB kuru öner
            </button>
          </div>
          {kurMesaj ? <span className="pm-field-hint">{kurMesaj}</span> : null}
        </div>
      ) : null}
    </>
  );
}
