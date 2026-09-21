import { useEffect, useState, type FormEvent } from "react";
import { ODEME_YONTEMI_ETIKET, ODEME_YONTEMI_KODLARI } from "@shared/constants/kasa";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import { bugunYmd, parsePosTutar } from "../../lib/format";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: {
    tarih: string;
    tutar: number;
    odemeYontemi: OdemeYontemiKodu;
    aciklama: string | null;
  }) => Promise<void>;
};

export function PremiumKasaAvansModal({ open, saving, error, onClose, onSave }: Props) {
  const [tarih, setTarih] = useState(bugunYmd());
  const [tutar, setTutar] = useState("");
  const [odeme, setOdeme] = useState<OdemeYontemiKodu>("NAKIT");
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!open) return;
    setTarih(bugunYmd());
    setTutar("");
    setOdeme("NAKIT");
    setAciklama("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave({ tarih, tutar: t, odemeYontemi: odeme, aciklama: aciklama.trim() || null });
  }

  return (
    <PremiumModal
      open={open}
      title="Avans girişi"
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form="pm-form-avans" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {error ? <p className="pm-form-error">{error}</p> : null}
      <form id="pm-form-avans" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-field">
          <label htmlFor="pm-avans-tarih">Tarih</label>
          <input
            id="pm-avans-tarih"
            type="date"
            className="pm-input"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-avans-tutar">Tutar *</label>
          <MoneyInput id="pm-avans-tutar" value={tutar} onChange={setTutar} disabled={saving} />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-avans-odeme">Ödeme yöntemi</label>
          <select
            id="pm-avans-odeme"
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
          <label htmlFor="pm-avans-aciklama">Açıklama</label>
          <textarea
            id="pm-avans-aciklama"
            className="pm-input"
            rows={2}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            disabled={saving}
          />
        </div>
        <p className="pm-form-hint">Belge no kayıt sırasında otomatik üretilir (AVN-YYYY-######).</p>
      </form>
    </PremiumModal>
  );
}
