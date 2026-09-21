import { useMemo } from "react";
import type { useOfisKasa } from "../../hooks/useOfisKasa";
import { formatDateTr, formatTry } from "../../lib/format";
import {
  formatSignedTry,
  hesaplaOfisKasaDuzeltme,
  ofisKasaKategoriListeEtiketi,
  parseTutar,
} from "../../lib/ofisKasa";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type OfisApi = ReturnType<typeof useOfisKasa>;

type Props = {
  ofis: OfisApi;
};

export function PremiumOfisKasaDuzeltmeModal({ ofis }: Props) {
  const {
    duzeltmeHedef,
    dDogruTutar,
    setDDogruTutar,
    dTarih,
    setDTarih,
    dNot,
    setDNot,
    dErr,
    dKaydediyor,
    kapatDuzeltme,
    duzeltmeKaydet,
  } = ofis;

  const duzeltmeOnizleme = useMemo(() => {
    if (!duzeltmeHedef) return null;
    const dogru = parseTutar(dDogruTutar);
    if (!Number.isFinite(dogru) || dDogruTutar.trim() === "") return null;
    const refTip = duzeltmeHedef.islemTipi === "GELIR" ? "GELIR" : "GIDER";
    return hesaplaOfisKasaDuzeltme(refTip, duzeltmeHedef.tutar, dogru);
  }, [duzeltmeHedef, dDogruTutar]);

  return (
    <PremiumModal
      open={duzeltmeHedef != null}
      title="Düzeltme ekle"
      wide
      disabled={dKaydediyor}
      onClose={kapatDuzeltme}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={kapatDuzeltme} disabled={dKaydediyor}>
            Vazgeç
          </PremiumButton>
          <PremiumButton type="button" onClick={() => void duzeltmeKaydet()} disabled={dKaydediyor}>
            {dKaydediyor ? "Kaydediliyor…" : "Düzeltmeyi kaydet"}
          </PremiumButton>
        </>
      }
    >
      {dErr ? <p className="pm-form-error pm-modal-form-error">{dErr}</p> : null}
      {duzeltmeHedef ? (
        <>
          <fieldset className="pm-ofis-duzeltme-readonly">
            <legend>Orijinal işlem</legend>
            <div className="pm-form-grid pm-ofis-form-grid">
              <div className="pm-field">
                <label>İşlem no</label>
                <input className="pm-input" readOnly value={`#${duzeltmeHedef.id}`} />
              </div>
              <div className="pm-field">
                <label>Tarih</label>
                <input className="pm-input" readOnly value={formatDateTr(duzeltmeHedef.tarih)} />
              </div>
              <div className="pm-field">
                <label>Tip</label>
                <input className="pm-input" readOnly value={duzeltmeHedef.islemTipi === "GELIR" ? "Gelir" : "Gider"} />
              </div>
              <div className="pm-field">
                <label>Eski tutar</label>
                <input className="pm-input" readOnly value={formatTry(duzeltmeHedef.tutar)} />
              </div>
              <div className="pm-field pm-form-span2">
                <label>Kategori</label>
                <input
                  className="pm-input"
                  readOnly
                  value={ofisKasaKategoriListeEtiketi(duzeltmeHedef.kategori, duzeltmeHedef.ozelKategoriAdi)}
                />
              </div>
              <div className="pm-field pm-form-span2">
                <label>Açıklama</label>
                <input className="pm-input" readOnly value={duzeltmeHedef.aciklama?.trim() ? duzeltmeHedef.aciklama : "—"} />
              </div>
            </div>
          </fieldset>
          <div className="pm-form-grid pm-ofis-form-grid pm-ofis-duzeltme-form">
            <div className="pm-field">
              <label htmlFor="pm-ofk-dtarih">Düzeltme tarihi</label>
              <input
                id="pm-ofk-dtarih"
                className="pm-input"
                type="date"
                value={dTarih}
                onChange={(e) => setDTarih(e.target.value)}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-ofk-dtutar">Doğru tutar</label>
              <MoneyInput
                id="pm-ofk-dtutar"
                value={dDogruTutar}
                onChange={setDDogruTutar}
                placeholder="Orijinal tutardan farklı tutar"
              />
            </div>
            <div className="pm-field pm-form-span2">
              <label htmlFor="pm-ofk-dnot">Not</label>
              <textarea id="pm-ofk-dnot" className="pm-input" value={dNot} onChange={(e) => setDNot(e.target.value)} rows={2} />
            </div>
            {duzeltmeOnizleme?.ok ? (
              <div className="pm-field pm-form-span2 pm-ofis-duzeltme-onizleme">
                <label>Hesaplanan düzeltme</label>
                <div className="pm-ofis-duzeltme-onizleme-body">
                  <span className="pm-ofis-duzeltme-tur">{duzeltmeOnizleme.turEtiket}</span>
                  <span>
                    Fark: {formatTry(duzeltmeOnizleme.farkTutar)} · Kasa etkisi: {formatSignedTry(duzeltmeOnizleme.kasaEtkisi)}
                  </span>
                </div>
              </div>
            ) : duzeltmeOnizleme && !duzeltmeOnizleme.ok ? (
              <p className="pm-form-error pm-form-span2">{duzeltmeOnizleme.error}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </PremiumModal>
  );
}
