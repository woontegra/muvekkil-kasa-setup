import { useEffect, useState } from "react";
import type { IcraTahsilatOdeme, IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { OFIS_ODEME_YONTEMI_ETIKET, OFIS_ODEME_YONTEMI_KODLARI } from "@shared/constants/ofisKasa";
import { bugunYmd, formatCurrencyInputTR } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import { CrossCurrencyPaymentFields, type CrossCurrencyValue } from "../currency/CurrencyFields";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  taksit: IcraTahsilatTaksit | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
};

export function PremiumIcraTaksitOdemeModal({ open, taksit, onClose, onSaved, onError }: Props) {
  const [payment, setPayment] = useState<CrossCurrencyValue | null>(null);
  const [tarih, setTarih] = useState(bugunYmd());
  const [yontem, setYontem] = useState("NAKIT");
  const [aciklama, setAciklama] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    if (!open || !taksit) return;
    setPayment(null);
    setTarih(bugunYmd());
    setYontem("NAKIT");
    setAciklama("");
    setFormErr(null);
  }, [open, taksit]);

  async function kaydet() {
    if (!taksit || kaydediyor) return;
    setFormErr(null);
    const tutarSayi = payment?.tutar;
    if (tutarSayi == null || tutarSayi <= 0 || !payment?.kasaTutari) {
      setFormErr("Geçerli tutar girin.");
      return;
    }
    if (tutarSayi > taksit.kalanTutar + 0.001) {
      setFormErr("Ödeme tutarı kalan taksit tutarını aşamaz.");
      return;
    }
    setKaydediyor(true);
    try {
      const res = await window.api.icraTahsilatTaksitOdemeAl(taksit.id, {
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
      if (!res.ok) {
        const msg = res.error ?? "Ödeme kaydedilemedi";
        setFormErr(msg);
        onError(msg);
        return;
      }
      onSaved();
      onClose();
    } catch {
      const msg = "Ödeme kaydedilemedi";
      setFormErr(msg);
      onError(msg);
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <PremiumModal
      open={open && taksit != null}
      title="Taksit ödemesi al"
      disabled={kaydediyor}
      onClose={onClose}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={kaydediyor}>
            Vazgeç
          </PremiumButton>
          <PremiumButton type="button" onClick={() => void kaydet()} disabled={kaydediyor}>
            {kaydediyor ? "Kaydediliyor…" : "Ödemeyi kaydet"}
          </PremiumButton>
        </>
      }
    >
      {taksit ? (
        <>
          <p className="pm-icra-submodal-meta">Taksit no: {taksit.taksitNo}</p>
          <p className="pm-icra-submodal-kalan">
            Kalan: <strong>{formatMoney(taksit.kalanTutar, taksit.paraBirimi)}</strong>
          </p>
          {formErr ? <p className="pm-form-error">{formErr}</p> : null}
          <div className="pm-form-grid pm-icra-form-grid">
            <CrossCurrencyPaymentFields
              idPrefix="pm-icra-odeme"
              alacakParaBirimi={taksit.paraBirimi}
              kalanBorc={taksit.kalanTutar}
              initialTutar={formatCurrencyInputTR(taksit.kalanTutar)}
              disabled={kaydediyor}
              onChange={setPayment}
            />
            <div className="pm-field">
              <label htmlFor="pm-icra-odeme-tarih">Tarih</label>
              <input
                id="pm-icra-odeme-tarih"
                className="pm-input"
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-icra-odeme-yontem">Ödeme yöntemi</label>
              <select
                id="pm-icra-odeme-yontem"
                className="pm-input"
                value={yontem}
                onChange={(e) => setYontem(e.target.value)}
              >
                {OFIS_ODEME_YONTEMI_KODLARI.map((k) => (
                  <option key={k} value={k}>
                    {OFIS_ODEME_YONTEMI_ETIKET[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-field pm-form-span2">
              <label htmlFor="pm-icra-odeme-aciklama">Açıklama / not</label>
              <input
                id="pm-icra-odeme-aciklama"
                className="pm-input"
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}
    </PremiumModal>
  );
}
