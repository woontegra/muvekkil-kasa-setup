import { useEffect, useState } from "react";
import { ODEME_YONTEMI_ETIKET, ODEME_YONTEMI_KODLARI } from "@shared/constants/kasa";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import { bugunYmd, parsePosTutar } from "../lib/format";
import { DeskModalBackdrop } from "./DeskModalBackdrop";
import { DeskModalPortal } from "./DeskModalPortal";
import { DeskModalHead } from "./DeskModalHead";
import { MoneyInput } from "./MoneyInput";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: { tarih: string; tutar: number; odemeYontemi: OdemeYontemiKodu; aciklama: string | null }) => Promise<void>;
};

export function KasaAvansModal({ open, saving, error, onClose, onSave }: Props) {
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

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave({ tarih, tutar: t, odemeYontemi: odeme, aciklama: aciklama.trim() || null });
  }

  return (
    <DeskModalPortal>
    <DeskModalBackdrop onClose={onClose}>
      <div className="modal modal-desk" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <DeskModalHead title="Avans girişi" onClose={onClose} closeDisabled={saving} />
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-avans" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="avans-tarih">Tarih</label>
              <input id="avans-tarih" type="date" className="desk-input" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="avans-tutar">Tutar *</label>
              <MoneyInput id="avans-tutar" value={tutar} onChange={setTutar} disabled={saving} />
            </div>
            <div className="field">
              <label htmlFor="avans-odeme">Ödeme yöntemi</label>
              <select id="avans-odeme" className="desk-input" value={odeme} onChange={(e) => setOdeme(e.target.value as OdemeYontemiKodu)}>
                {ODEME_YONTEMI_KODLARI.map((k) => (
                  <option key={k} value={k}>
                    {ODEME_YONTEMI_ETIKET[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="avans-aciklama">Açıklama</label>
              <textarea id="avans-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </div>
            <p className="desk-muted-compact">Belge no kayıt sırasında otomatik üretilir (AVN-YYYY-######).</p>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
            İptal
          </button>
          <button type="submit" form="form-avans" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </DeskModalBackdrop>
    </DeskModalPortal>
  );
}
