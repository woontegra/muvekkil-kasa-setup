import { useEffect, useState, type FormEvent } from "react";
import type { KasaHareket } from "@shared/types/kasa";
import { bugunYmd, formatDateTr, parsePosTutar } from "../../lib/format";
import { tipEtiket } from "../../lib/kasa";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  hedef: KasaHareket | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: { tutar: number; tarih: string; aciklama: string }) => Promise<void>;
};

export function PremiumKasaDuzeltmeModal({ hedef, saving, error, onClose, onSave }: Props) {
  const [isaret, setIsaret] = useState<"+" | "-">("-");
  const [tutar, setTutar] = useState("");
  const [tarih, setTarih] = useState(bugunYmd());
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!hedef) return;
    setIsaret("-");
    setTutar("");
    setTarih(bugunYmd());
    setAciklama("");
  }, [hedef]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || !hedef) return;
    const raw = parsePosTutar(tutar);
    if (raw == null) return;
    const ac = aciklama.trim();
    if (!ac) return;
    const signed = isaret === "+" ? raw : -raw;
    await onSave({ tutar: signed, tarih, aciklama: ac });
  }

  return (
    <PremiumModal
      open={hedef != null}
      title="Düzeltme kaydı"
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form="pm-form-duzeltme" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Düzeltme kaydet"}
          </PremiumButton>
        </>
      }
    >
      {hedef ? (
        <>
          {error ? <p className="pm-form-error">{error}</p> : null}
          <p className="pm-form-hint pm-duzeltme-hedef">
            Düzeltilen işlem: <strong>#{hedef.id}</strong> · {tipEtiket(hedef.islemTipi)} ·{" "}
            {formatDateTr(hedef.tarih)}
          </p>
          <form id="pm-form-duzeltme" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
            <div className="pm-form-row">
              <div className="pm-field">
                <label htmlFor="pm-dz-isaret">İşaret</label>
                <select
                  id="pm-dz-isaret"
                  className="pm-input"
                  value={isaret}
                  onChange={(e) => setIsaret(e.target.value as "+" | "-")}
                  disabled={saving}
                >
                  <option value="-">Eksi (−)</option>
                  <option value="+">Artı (+)</option>
                </select>
              </div>
              <div className="pm-field">
                <label htmlFor="pm-dz-tutar">Tutar *</label>
                <MoneyInput id="pm-dz-tutar" value={tutar} onChange={setTutar} disabled={saving} />
              </div>
            </div>
            <div className="pm-field">
              <label htmlFor="pm-dz-tarih">Tarih</label>
              <input
                id="pm-dz-tarih"
                type="date"
                className="pm-input"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-dz-aciklama">Açıklama *</label>
              <textarea
                id="pm-dz-aciklama"
                className="pm-input"
                rows={2}
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                disabled={saving}
              />
            </div>
          </form>
        </>
      ) : null}
    </PremiumModal>
  );
}
