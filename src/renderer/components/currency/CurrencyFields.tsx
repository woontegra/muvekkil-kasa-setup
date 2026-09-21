import { useEffect, useState } from "react";
import {
  PARA_BIRIMLERI,
  PARA_BIRIMI_LABEL,
  type KurKaynagi,
  type ParaBirimi,
} from "@shared/lib/paraBirimi";
import { formatCurrencyInputTR, parsePosTutar } from "../../lib/format";
import { MoneyInput } from "../MoneyInput";

export type CrossCurrencyValue = {
  tutar: number | null;
  odemeParaBirimi: ParaBirimi;
  kasaTutari: number | null;
  kurKaynagi?: KurKaynagi;
  tcmbKurTarihi?: string | null;
  tcmbReferansKur?: number | null;
};

export function ParaBirimiSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: ParaBirimi;
  onChange: (value: ParaBirimi) => void;
  disabled?: boolean;
}) {
  return (
    <select id={id} className="desk-input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as ParaBirimi)}>
      {PARA_BIRIMLERI.map((pb) => <option key={pb} value={pb}>{pb} — {PARA_BIRIMI_LABEL[pb]}</option>)}
    </select>
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
  const [meta, setMeta] = useState<Partial<CrossCurrencyValue>>({});
  const [mesaj, setMesaj] = useState("");
  const cross = odemePb !== alacakParaBirimi;

  useEffect(() => {
    setTutar(initialTutar);
    setKasaTutari(initialTutar);
    setOdemePb(alacakParaBirimi);
    setMeta({});
  }, [alacakParaBirimi, initialTutar]);

  useEffect(() => {
    onChange({ tutar: parsePosTutar(tutar), odemeParaBirimi: odemePb, kasaTutari: parsePosTutar(kasaTutari), ...meta });
  }, [tutar, odemePb, kasaTutari, meta, onChange]);

  async function tcmbOner() {
    const mahsup = parsePosTutar(tutar);
    if (!mahsup || !cross) return;
    setMesaj("TCMB kuru alınıyor…");
    try {
      const r = await window.api.kurlarTcmbCapraz({ baz: alacakParaBirimi, karsi: odemePb });
      if (!r.ok || !r.available) {
        setMesaj(r.error ?? "Kur bulunamadı.");
        return;
      }
      const kur = Number(r.dovizAlis);
      setKasaTutari(formatCurrencyInputTR(mahsup * kur));
      setMeta({ kurKaynagi: "TCMB", tcmbKurTarihi: r.bulunanTcmbKurTarihi, tcmbReferansKur: kur });
      setMesaj(`TCMB ${r.bulunanTcmbKurTarihi}: 1 ${alacakParaBirimi} = ${kur.toFixed(8)} ${odemePb}`);
    } catch {
      setMesaj("Kur alınamadı; kasa tutarını elle girin.");
    }
  }

  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-mahsup`}>Borçtan düşülecek ({alacakParaBirimi}) *</label>
        <MoneyInput id={`${idPrefix}-mahsup`} value={tutar} maxValue={kalanBorc} disabled={disabled} onChange={(v) => {
          setTutar(v);
          if (!cross) setKasaTutari(v);
        }} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-pb`}>Ödeme para birimi</label>
        <ParaBirimiSelect id={`${idPrefix}-pb`} value={odemePb} disabled={disabled} onChange={(pb) => {
          setOdemePb(pb);
          setMeta({});
          setMesaj("");
          if (pb === alacakParaBirimi) setKasaTutari(tutar);
        }} />
      </div>
      {cross ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-kasa`}>Kasaya giren ({odemePb}) *</label>
          <MoneyInput id={`${idPrefix}-kasa`} value={kasaTutari} disabled={disabled} onChange={(v) => {
            setKasaTutari(v);
            setMeta({ kurKaynagi: "MANUEL", tcmbKurTarihi: null, tcmbReferansKur: null });
          }} />
          <button type="button" className="btn btn-sm" onClick={() => void tcmbOner()} disabled={disabled}>TCMB kuru öner</button>
          {mesaj ? <small className="muted">{mesaj}</small> : null}
        </div>
      ) : null}
    </>
  );
}
