import { useEffect, useState } from "react";
import type { IcraTahsilatOdeme, IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { OFIS_ODEME_YONTEMI_ETIKET, OFIS_ODEME_YONTEMI_KODLARI } from "@shared/constants/ofisKasa";
import { bugunYmd, formatCurrencyInputTR } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import { CrossCurrencyPaymentFields, type CrossCurrencyValue } from "../currency/CurrencyFields";
import { DeskModalBackdrop } from "../DeskModalBackdrop";

type Props = {
  open: boolean;
  taksit: IcraTahsilatTaksit | null;
  onClose: () => void;
  onSaved: () => void;
};

export function IcraTahsilatTaksitOdemeModal({ open, taksit, onClose, onSaved }: Props) {
  const [payment, setPayment] = useState<CrossCurrencyValue | null>(null);
  const [tarih, setTarih] = useState(bugunYmd());
  const [yontem, setYontem] = useState("NAKIT");
  const [aciklama, setAciklama] = useState("");
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    if (!open || !taksit) return;
    setPayment(null);
    setTarih(bugunYmd());
    setYontem("NAKIT");
    setAciklama("");
  }, [open, taksit]);

  if (!open || !taksit) return null;

  async function kaydet() {
    if (!taksit || kaydediyor) return;
    const tutarSayi = payment?.tutar;
    if (tutarSayi == null || tutarSayi <= 0 || !payment?.kasaTutari) {
      alert("Geçerli tutar girin.");
      return;
    }
    if (tutarSayi > taksit.kalanTutar + 0.001) {
      alert("Ödeme tutarı kalan taksit tutarını aşamaz.");
      return;
    }
    setKaydediyor(true);
    try {
      const res = await window.api?.icraTahsilatTaksitOdemeAl?.(taksit.id, {
        tutar: tutarSayi,
        odemeParaBirimi: payment.odemeParaBirimi,
        kasaTutari: payment.kasaTutari,
        kurKaynagi: payment.kurKaynagi,
        tcmbKurTarihi: payment.tcmbKurTarihi,
        tcmbReferansKur: payment.tcmbReferansKur,
        odemeTarihi: tarih,
        odemeYontemi: yontem as IcraTahsilatOdeme["odemeYontemi"],
        aciklama: aciklama.trim() || null,
      });
      if (!res?.ok) {
        alert(res?.error ?? "Ödeme kaydedilemedi");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <DeskModalBackdrop className="modal-backdrop desk-icra-submodal-backdrop" onClose={onClose}>
      <div
        className="modal modal-desk modal-desk--icra-taksit-odeme"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="icra-taksit-odeme-title"
      >
        <div className="modal-header desk-icra-submodal-header">
          <h2 id="icra-taksit-odeme-title">Taksit ödemesi al</h2>
          <button type="button" className="desk-icra-detay-close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>
        <div className="modal-body desk-icra-submodal-body">
          <p className="desk-icra-submodal-meta">Taksit No: {taksit.taksitNo}</p>
          <p className="desk-icra-submodal-kalan">
            Kalan: <strong className="desk-num">{formatMoney(taksit.kalanTutar, taksit.paraBirimi)}</strong>
          </p>
          <CrossCurrencyPaymentFields
            idPrefix="icra-odeme"
            alacakParaBirimi={taksit.paraBirimi}
            kalanBorc={taksit.kalanTutar}
            initialTutar={formatCurrencyInputTR(taksit.kalanTutar)}
            disabled={kaydediyor}
            onChange={setPayment}
          />
          <label className="desk-form-field">
            <span>Tarih</span>
            <input className="desk-input form-input" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
          </label>
          <label className="desk-form-field">
            <span>Ödeme yöntemi</span>
            <select className="desk-input form-input" value={yontem} onChange={(e) => setYontem(e.target.value)}>
              {OFIS_ODEME_YONTEMI_KODLARI.map((k) => (
                <option key={k} value={k}>
                  {OFIS_ODEME_YONTEMI_ETIKET[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="desk-form-field">
            <span>Açıklama / not</span>
            <input className="desk-input form-input" value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
          </label>
        </div>
        <div className="modal-foot desk-icra-submodal-foot">
          <div className="desk-modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={kaydediyor}>
              Vazgeç
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void kaydet()} disabled={kaydediyor}>
              Ödemeyi Kaydet
            </button>
          </div>
        </div>
      </div>
    </DeskModalBackdrop>
  );
}
