import { useEffect, useState } from "react";
import type { VekaletTaksitOdeme } from "@shared/types/vekalet";
import { OFIS_ODEME_YONTEMI_ETIKET, OFIS_ODEME_YONTEMI_KODLARI } from "@shared/constants/ofisKasa";
import { formatCurrencyInputTR } from "../../lib/format";
import { parseTutar } from "../../lib/ofisKasa";
import { MoneyInput } from "../MoneyInput";
import { ParaBirimiSelect } from "../currency/CurrencyFields";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";
import type { ParaBirimi } from "@shared/lib/paraBirimi";

type Props = {
  open: boolean;
  odeme: VekaletTaksitOdeme | null;
  maxMahsup: number;
  onClose: () => void;
  onSaved: () => void;
};

export function PremiumVekaletOdemeEditModal({ open, odeme, maxMahsup, onClose, onSaved }: Props) {
  const [tutar, setTutar] = useState("");
  const [tarih, setTarih] = useState("");
  const [yontem, setYontem] = useState("NAKIT");
  const [aciklama, setAciklama] = useState("");
  const [odemePb, setOdemePb] = useState<ParaBirimi>("TRY");
  const [kasaTutari, setKasaTutari] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !odeme) return;
    setTutar(formatCurrencyInputTR(odeme.tutar));
    setTarih(odeme.odemeTarihi.slice(0, 10));
    setYontem(odeme.odemeYontemi);
    setAciklama(odeme.aciklama ?? "");
    setOdemePb(odeme.odemeParaBirimi);
    setKasaTutari(formatCurrencyInputTR(odeme.kasaTutari));
    setErr(null);
  }, [open, odeme]);

  function kapat() {
    if (busy) return;
    setErr(null);
    onClose();
  }

  async function kaydet() {
    if (!odeme || busy) return;
    setErr(null);
    const mahsup = parseTutar(tutar);
    if (!Number.isFinite(mahsup) || mahsup <= 0) {
      setErr("Geçerli tutar girin.");
      return;
    }
    if (mahsup > maxMahsup + 0.001) {
      setErr(`Mahsup tutarı kalan bakiyeyi aşamaz (${maxMahsup}).`);
      return;
    }
    setBusy(true);
    try {
      const r = await window.api.vekaletTaksitOdemeGuncelle(odeme.id, {
        tutar: mahsup,
        odemeTarihi: tarih,
        odemeYontemi: yontem,
        aciklama: aciklama.trim() || null,
        odemeParaBirimi: odemePb,
        kasaTutari: odemePb === odeme.alacakParaBirimi ? mahsup : parseTutar(kasaTutari),
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr("Güncelleme başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumModal
      open={open && odeme != null}
      title="Tahsilatı düzenle"
      wide
      disabled={busy}
      onClose={kapat}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" disabled={busy} onClick={kapat}>
            Vazgeç
          </PremiumButton>
          <PremiumButton type="button" disabled={busy} onClick={() => void kaydet()}>
            Kaydet
          </PremiumButton>
        </>
      }
    >
      {err ? <p className="pm-form-error">{err}</p> : null}
      <p className="pm-muted">
        Makbuz no, SMM ve TCMB kur anlık görüntüsü korunur. Onaylı ofis kasasına bağlı tahsilatlar düzenlenemez —
        önce güvenli iptal gerekir.
      </p>
      <div className="pm-form-grid">
        <div className="pm-field">
          <label>Ödeme tarihi</label>
          <input className="pm-input" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
        </div>
        <div className="pm-field">
          <label>Mahsup tutarı ({odeme?.alacakParaBirimi})</label>
          <MoneyInput value={tutar} onChange={setTutar} />
        </div>
        <div className="pm-field">
          <label>Ödeme PB</label>
          <ParaBirimiSelect value={odemePb} onChange={setOdemePb} />
        </div>
        {odeme && odemePb !== odeme.alacakParaBirimi ? (
          <div className="pm-field">
            <label>Kasa tutarı ({odemePb})</label>
            <MoneyInput value={kasaTutari} onChange={setKasaTutari} />
          </div>
        ) : null}
        <div className="pm-field">
          <label>Ödeme yöntemi</label>
          <select className="pm-input" value={yontem} onChange={(e) => setYontem(e.target.value)}>
            {OFIS_ODEME_YONTEMI_KODLARI.map((k) => (
              <option key={k} value={k}>
                {OFIS_ODEME_YONTEMI_ETIKET[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="pm-field pm-form-span2">
          <label>Açıklama</label>
          <textarea className="pm-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
        </div>
      </div>
    </PremiumModal>
  );
}
