import { useEffect, useState, type FormEvent } from "react";
import { ODEME_YONTEMI_ETIKET, ODEME_YONTEMI_KODLARI } from "@shared/constants/kasa";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type { TaksitOdemeAlInput, VekaletTaksit } from "@shared/types/vekalet";
import { bugunYmd, formatCurrencyInputTR } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import { CrossCurrencyPaymentFields, type CrossCurrencyValue } from "../currency/CurrencyFields";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksit: VekaletTaksit;
  onClose: () => void;
  onSave: (data: TaksitOdemeAlInput) => Promise<void>;
};

export function PremiumTaksitOdemeModal({ open, saving, error, taksit, onClose, onSave }: Props) {
  const [payment, setPayment] = useState<CrossCurrencyValue | null>(null);
  const [tarih, setTarih] = useState(bugunYmd());
  const [odeme, setOdeme] = useState<OdemeYontemiKodu>("NAKIT");
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!open) return;
    setPayment(null);
    setTarih(bugunYmd());
    setOdeme("NAKIT");
    setAciklama("");
  }, [open, taksit.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!payment?.tutar || !payment.kasaTutari) return;
    await onSave({
      tutar: payment.tutar,
      odemeParaBirimi: payment.odemeParaBirimi,
      kasaTutari: payment.kasaTutari,
      kurKaynagi: payment.kurKaynagi,
      tcmbKurTarihi: payment.tcmbKurTarihi,
      tcmbReferansKur: payment.tcmbReferansKur,
      odemeTarihi: tarih,
      odemeYontemi: odeme,
      aciklama: aciklama.trim() || null,
    });
  }

  return (
    <PremiumModal
      open={open}
      title={`Taksit #${taksit.taksitNo} — ödeme al`}
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form="pm-form-odeme-al" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Tahsilat kaydet"}
          </PremiumButton>
        </>
      }
    >
      {error ? <p className="pm-form-error">{error}</p> : null}
      <form id="pm-form-odeme-al" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-vekalet-kv-grid">
          <div className="pm-vekalet-kv">
            <span className="pm-vekalet-kv-k">Taksit tutarı</span>
            <span className="pm-vekalet-kv-v">{formatMoney(taksit.tutar, taksit.paraBirimi)}</span>
          </div>
          <div className="pm-vekalet-kv">
            <span className="pm-vekalet-kv-k">Şimdiye kadar ödenen</span>
            <span className="pm-vekalet-kv-v">{formatMoney(taksit.odenenToplam, taksit.paraBirimi)}</span>
          </div>
          <div className="pm-vekalet-kv">
            <span className="pm-vekalet-kv-k">Ödenmesi gereken kalan</span>
            <span className="pm-vekalet-kv-v">{formatMoney(taksit.kalanTutar, taksit.paraBirimi)}</span>
          </div>
        </div>
        <div className="pm-form-grid">
          <CrossCurrencyPaymentFields
            idPrefix="pm-oa"
            alacakParaBirimi={taksit.paraBirimi}
            kalanBorc={taksit.kalanTutar}
            initialTutar={formatCurrencyInputTR(taksit.kalanTutar)}
            disabled={saving}
            onChange={setPayment}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-oa-tarih">Ödeme tarihi</label>
          <input
            id="pm-oa-tarih"
            type="date"
            className="pm-input"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-oa-odeme">Ödeme yöntemi</label>
          <select
            id="pm-oa-odeme"
            className="pm-input"
            value={odeme}
            onChange={(e) => setOdeme(e.target.value as OdemeYontemiKodu)}
            disabled={saving}
          >
            {ODEME_YONTEMI_KODLARI.map((k) => (
              <option key={k} value={k}>
                {ODEME_YONTEMI_ETIKET[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="pm-field">
          <label htmlFor="pm-oa-aciklama">Açıklama</label>
          <textarea
            id="pm-oa-aciklama"
            className="pm-input"
            rows={2}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            disabled={saving}
          />
        </div>
      </form>
    </PremiumModal>
  );
}
